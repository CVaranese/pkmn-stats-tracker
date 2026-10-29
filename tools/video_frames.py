"""Cut crops out of a match video into PNG files, using headless Edge (no ffmpeg needed).

    python -I tools/video_frames.py <video.mp4> <out_dir> --times 60,70,80 [--box 640,60,640,600] [--scale 2]
    python -I tools/video_frames.py <video.mp4> <out_dir> --every 8 --start 30 --end 640

Serves tools/video_grab.html and the video from a local server with HTTP Range support (Python's http.server
can't seek video), opens the page in headless Edge on the real clock, and the page POSTs one PNG per time to
/save. Each file is named <out_dir>/f<seconds*10, 5 digits>.png. Edge is killed once the page reports done.
"""
import argparse, http.server, os, subprocess, sys, threading, time, urllib.parse

EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
TOOLS = os.path.dirname(os.path.abspath(__file__))


def make_handler(video, out_dir, done):
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=TOOLS, **k)

        def do_POST(self):
            u = urllib.parse.urlparse(self.path)
            q = urllib.parse.parse_qs(u.query)
            body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            if u.path == "/save":
                name = os.path.basename(q["name"][0])
                with open(os.path.join(out_dir, name), "wb") as f:
                    f.write(body)
            elif u.path == "/done":
                print("page:", body.decode("utf-8", "replace"))
                done.set()
            self.send_response(204)
            self.end_headers()

        def send_head(self):
            u = urllib.parse.urlparse(self.path)
            if u.path == "/hold":  # keeps the page's load event open until /done
                done.wait(1800)
                self.send_response(204)
                self.end_headers()
                return None
            if u.path != "/video.mp4":
                return super().send_head()
            size = os.path.getsize(video)
            rng = self.headers.get("Range") or "bytes=0-"
            a, _, b = rng.split("=", 1)[1].partition("-")
            start = int(a or 0)
            end = int(b) if b else size - 1
            f = open(video, "rb")
            f.seek(start)
            self.send_response(206)
            self.send_header("Content-Type", "video/mp4")
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Content-Length", str(end - start + 1))
            self.end_headers()
            self._left = end - start + 1
            return f

        def copyfile(self, src, dst):
            left = getattr(self, "_left", None)
            if left is None:
                return super().copyfile(src, dst)
            try:
                while left > 0:
                    b = src.read(min(65536, left))
                    if not b:
                        break
                    dst.write(b)
                    left -= len(b)
            except (ConnectionError, OSError):
                pass  # the browser drops range requests it no longer needs

        def log_message(self, *a):
            pass

    return H


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("out_dir")
    ap.add_argument("--times", help="comma-separated seconds")
    ap.add_argument("--every", type=float)
    ap.add_argument("--start", type=float, default=0)
    ap.add_argument("--end", type=float)
    ap.add_argument("--box", default="640,60,640,600", help="x,y,w,h in the 1280x720 frame; 'full' for all of it")
    ap.add_argument("--scale", type=float, default=2)
    ap.add_argument("--filter", default="", help="canvas filter, e.g. 'grayscale(1) contrast(1.6)'")
    ap.add_argument("--port", type=int, default=8771)
    ap.add_argument("--jpeg", action="store_true", help="save JPEG (85%%) instead of PNG: smaller, for review pictures")
    args = ap.parse_args()
    if args.times:
        times = [float(t) for t in args.times.split(",")]
    else:
        times, t = [], args.start
        while t <= args.end:
            times.append(round(t, 1))
            t += args.every
    os.makedirs(args.out_dir, exist_ok=True)
    done = threading.Event()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", args.port),
                                          make_handler(os.path.abspath(args.video), args.out_dir, done))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    box = "0,0,1280,720" if args.box == "full" else args.box
    ext = ".jpg" if args.jpeg else ".png"
    name = lambda t: f"f{round(t * 10):05d}{ext}"
    profile = os.path.join(os.environ.get("TEMP", "."), "edge-headless-frames")
    t0, skipped, launches, ok = time.time(), [], 0, False
    # Edge's video decoder sometimes wedges for good (no seek finishes, even on a new <video>): when no frame
    # arrives for STALL seconds, end that Edge and start a new one from the next frame, skipping the stuck one.
    STALL = 30
    while True:
        left = [t for t in times if t not in skipped and not os.path.exists(os.path.join(args.out_dir, name(t)))]
        if not left or launches > 20:
            ok = not left
            break
        launches += 1
        done.clear()
        url = (f"http://127.0.0.1:{args.port}/video_grab.html?t={','.join(map(str, left))}"
               f"&box={box}&scale={args.scale}&filter={urllib.parse.quote(args.filter)}" + ("&jpeg=1" if args.jpeg else ""))
        p = subprocess.Popen([EDGE, "--headless=new", "--disable-gpu", "--mute-audio", "--autoplay-policy=no-user-gesture-required",
                              f"--user-data-dir={profile}-{launches}", "--dump-dom", url],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        count = lambda: sum(1 for f in os.listdir(args.out_dir) if f.endswith(ext))
        last_n, last_t = count(), time.time()
        while not done.wait(2):
            if count() != last_n:
                last_n, last_t = count(), time.time()
            elif time.time() - last_t > STALL + (15 if last_n == 0 else 0):
                stuck = next(t for t in left if not os.path.exists(os.path.join(args.out_dir, name(t))))
                print(f"stalled at {stuck} s: new Edge from the next frame", flush=True)
                skipped.append(stuck)
                break
        subprocess.run(["taskkill", "/T", "/F", "/PID", str(p.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if done.is_set():   # the page went through every time; any frame it couldn't seek to stays skipped
            time.sleep(0.5)
            skipped += [t for t in left if not os.path.exists(os.path.join(args.out_dir, name(t)))]
    srv.shutdown()
    n = sum(1 for f in os.listdir(args.out_dir) if f.endswith(ext))
    if skipped:
        print(f"skipped (stuck): {', '.join(map(str, skipped))}")
    print(f"{'done' if ok else 'TIMEOUT'}: {len(times)} times, {n} PNGs in {args.out_dir}, {time.time() - t0:.0f} s")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
