# Video-rebuilt games: what to fix by hand

Made by `python -I tools/audit_video_games.py` from the logs alone (no video). Each line gives the turn, the
log line number (in the game's `site/ppppp/games/<id>.json` `log`, counting from 1) and what looks wrong. Some are
real (a turn spent recharging, a Pokémon that can't move with no line for it), so check each against the video.
35 games, 36 things to check.

Coming back with more HP is only flagged for Pokémon that can't have Regenerator. Re-run after fixing.

## Week 1: azpmCloudburst vs chicken parm karm (`video-d5ivr2s_7de`, 24 turns)
Video: https://youtu.be/d5iVr2s_7dE

- Nothing found.

## Week 1: ElkG Big Large vs weedinmyhonda (`video-ff5wimd_i3k`, 27 turns)
Video: https://youtu.be/ff5WImD_i3k

- Nothing found.

## Week 2: Nezergy vs pee nation (`video-d1nx5qvh-ca`, 45 turns)
Video: https://youtu.be/d1nX5QVh-CA

- Nothing found.

## Week 2: FingerStripes vs azpmCloudburst (`video-yytuzxi96hg`, 18 turns)
Video: https://youtu.be/yytUZXI96hg

- Nothing found.

## Week 2: DEJIME17 vs chicken parm karm (`video-yj0pgvbcbli`, 26 turns)
Video: https://youtu.be/Yj0PgVbcblI

- Nothing found.

## Week 2: PeterPikmon vs ElkG Big Large (`video-jjacbpx4g2e`, 36 turns)
Video: https://youtu.be/JJaCbPX4g2E

- Nothing found.

## Week 2: doxsego vs weedinmyhonda (`video-4facablyaoc`, 19 turns)
Video: https://youtu.be/4fACABLYaoc

- Nothing found.

## Week 3: Zololab vs weedinmyhonda (`video-oqam2awttbc`, 48 turns)
Video: https://youtu.be/OQAm2AwTtBc

- Nothing found.

## Week 3: DEJIME17 vs doxsego (`video-i21s40qi4em`, 15 turns)
Video: https://youtu.be/I21S40QI4EM

- Nothing found.

## Week 3: ElkG Big Large vs chicken parm karm (`video-bgmhhbybbam`, 17 turns)
Video: https://youtu.be/BGMHhByBbaM

- Nothing found.

## Week 3: azpmCloudburst vs potatoesareyum (`video-uffx_ququzw`, 19 turns)
Video: https://youtu.be/UFfx_QuquZw

- [ ] Turn 11, line 112: names a Pokémon that never came onto the field (p2: 'God'): misread name, its effect is lost: `|-unboost|p2a: God|Grift's Attack|1`
- [ ] Turn 18, line 169: names a Pokémon that never came onto the field (p1: 'play The opposing God'): misread name, its effect is lost: `|-boost|p1a: play The opposing God|Grift's Sp. Atk|1`
- [ ] Turn 18, line 170: names a Pokémon that never came onto the field (p2: 'God'): misread name, its effect is lost: `|-boost|p2a: God|Grift's Sp. Def|1`

## Week 3: FingerStripes vs pee nation (`video-mqda-z2vz9e`, 43 turns)
Video: https://youtu.be/mqDA-Z2vZ9E

- Nothing found.

## Week 4: Zololab vs DEJIME17 (`video-mebkxaukmlw`, 15 turns)
Video: https://youtu.be/mEbKXAuKmLw

- [ ] Turn 14, line 132: Pie loses HP with no move before it: the attack line is missing or misread
- [ ] Turn 14, line 136: p1 (Parin) did nothing this turn: a move or 'can't move' line may be missing

## Week 4: potatoesareyum vs weedinmyhonda (`video-yvl4oae9bmc`, 13 turns)
Video: https://youtu.be/yvl4OaE9BMc

- [ ] Turn 4, line 46: BIGBIRD takes 'Recoil' damage but stays at 100%: the HP is misread

## Week 4: azpmCloudburst vs doxsego (`video-vxtlxlnr19c`, 33 turns)
Video: https://youtu.be/vxtlxLNR19c
Already noted on the site: Turn 19: Ceruledge is shown at 0% after Sucker Punch but didn't faint (it comes back at 1%), so that hit is about 1% too high.

- [ ] Turn 3, line 39: Dumbass takes 'Recoil' damage but stays at 73%: the HP is misread
- [ ] Turn 4, line 45: Dumbass takes 'Recoil' damage but stays at 73%: the HP is misread
- [ ] Turn 10, line 87: Dumbass takes 'Recoil' damage but stays at 52%: the HP is misread
- [ ] Turn 12, line 105: Dumbass takes 'Recoil' damage but stays at 1%: the HP is misread
- [ ] Turn 22, line 161: brick wall goes to 0 ('0 fnt') with no faint and comes back at 1% (line 173): the HP is misread
- [ ] Turn 23, line 188: says hit 1 times but 3 hit lines on Zapdash: hits missing
- [ ] Turn 27, line 211: says hit 1 times but 3 hit lines on Ariana Grande: hits missing
- [ ] Turn ?, line 239: Global Warming goes to 0 ('0 fnt') but never faints: a misread HP

## Week 4: FingerStripes vs ElkG Big Large (`video-yycxiiszqek`, 33 turns)
Video: https://youtu.be/yyCXiIsZQek
Already noted on the site: Turn 10: Sableye is shown at 0% after Dark Pulse but didn't faint (it comes back at 1%).

- [ ] Turn 0, line 25: move 'its Booster Energy to activate its Quark Driv' isn't a Showdown move: misread
- [ ] Turn 20, line 90: Raven goes to 0 ('0 fnt') with no faint and comes back at 1% (line 158): the HP is misread

## Week 4: PeterPikmon vs pee nation (`video-ktyq3nes_gm`, 25 turns)
Video: https://youtu.be/ktYq3NES_GM

- Nothing found.

## Week 5: FingerStripes vs PeterPikmon (`video-cklxgwzl3hm`, 30 turns)
Video: https://youtu.be/CKLxgWZL3HM

- [ ] Turn 9, line 95: says hit 1 times but 5 hit lines on Geo-Force: hits missing

## Week 5: doxsego vs potatoesareyum (`video-vxg51mjkssw`, 23 turns)
Video: https://youtu.be/vXg51MJkSSw

- Nothing found.

## Week 5: chicken parm karm vs Zololab (`video-opud2yunqrs`, 26 turns)
Video: https://youtu.be/oPUD2yUnQrs

- Nothing found.

## Week 5: weedinmyhonda vs pee nation (`video-4n49bq2lqsy`, 17 turns)
Video: https://youtu.be/4n49BQ2LQsY
Already noted on the site: Turn 9: Landorus-Therian is shown at 0% after burn damage but didn't faint (it comes back at 48%), so its damage taken and the burn damage are too high.

- [ ] Turn 11, line 73: Lebron-Therian goes to 0 ('0 fnt') with no faint and comes back at 48% (line 105): the HP is misread
- [ ] Turn 17, line 141: Charizard Mega Y takes 'ability: Iron Barbs [of] p1a: Fentanyl' damage but stays at 70%: the HP is misread

## Week 5: DEJIME17 vs ElkG Big Large (`video-xcoo3lljspm`, 28 turns)
Video: https://youtu.be/xcoo3llJSpM
Already noted on the site: Turn 6: Overqwil is shown at 0% after a resisted Dark Pulse but didn't faint (it comes back at 55%), so that hit counts about 55% too much damage.

- [ ] Turn 27, line 68: Pie goes to 0 ('0 fnt') with no faint and comes back at 55% (line 223): the HP is misread
- [ ] Turn 10, line 96: says hit 5 times but 4 hit lines on iHardlyKnowHer: hits missing

## Week 6: azpmCloudburst vs weedinmyhonda (`video--zrrn-yi98u`, 18 turns)
Video: https://youtu.be/-ZRRN-yi98U

- [ ] Turn 10, line 103: Kum-Alola takes 'ability: Aftermath' damage but stays at 88%: the HP is misread
- [ ] Turn 10, line 103: Aftermath with nobody fainting just before: probably Rough Skin / Iron Barbs misread
- [ ] Turn 11, line 112: Badlands Chugs takes 'ability: Aftermath' damage but stays at 79%: the HP is misread
- [ ] Turn 11, line 112: Aftermath with nobody fainting just before: probably Rough Skin / Iron Barbs misread
- [ ] Turn 14, line 140: Kum-Alola takes 'ability: Aftermath' damage but stays at 75%: the HP is misread
- [ ] Turn 14, line 140: Aftermath with nobody fainting just before: probably Rough Skin / Iron Barbs misread
- [ ] Turn 17, line 167: p1 (Badlands Chugs) did nothing this turn: a move or 'can't move' line may be missing
- [ ] Turn 18, line 178: says hit 6 times but 4 hit lines on Duterte: hits missing

## Week 6: DEJIME vs pee nation (`video-d-snlpgnt04`, 16 turns)
Video: https://youtu.be/D-SnlPgNt04

- Nothing found.

## Week 6: FingerStripes vs potatoesareyum (`video-fivtp9wacta`, 34 turns)
Video: https://youtu.be/FiVtP9WAcTA

- Nothing found.

## Week 6: chicken parm karm vs PeterPikmon (`video-efjkwhtidmm`, 47 turns)
Video: https://youtu.be/efjkWhTidmM

- Nothing found.

## Week 7: pee nation vs chicken parm karm (`video-9stjz-xvmj8`, 16 turns)
Video: https://youtu.be/9STJZ-Xvmj8

- Nothing found.

## Week 7: Nezergy vs weedinmyhonda (`video-ecis5-ls6i0`, 26 turns)
Video: https://youtu.be/eCis5-Ls6i0

- [ ] Turn 19, line 165: Zeraora takes 'ability: Aftermath' damage but stays at 81%: the HP is misread
- [ ] Turn 19, line 165: Aftermath with nobody fainting just before: probably Rough Skin / Iron Barbs misread

## Week 7: Zololab vs ElkGBigLarge (`video-iysf4aqc3jq`, 36 turns)
Video: https://youtu.be/IYsf4aQc3jQ

- Nothing found.

## Week 7: peterpikmon vs potatoesareyum (`video-ek4vkzvwny0`, 22 turns)
Video: https://youtu.be/ek4VkZvwnY0

- [ ] Turn 14, line 115: p1 (Thunder Thighs) did nothing this turn: a move or 'can't move' line may be missing

## Week 7: FingerStripes vs doxsego (`video-pq9jwax63pc`, 26 turns)
Video: https://youtu.be/pq9jWAX63Pc

- Nothing found.

## Week 7: azpmCloudburst vs DEJIME (`video-s2znfx4ir1m`, 18 turns)
Video: https://youtu.be/s2ZnFx4iR1M
Already noted on the site: Turn 9: Zapdos is shown at 0% after Dragon Pulse but didn't faint (it comes back at 2%), so Raging Bolt's damage and Zapdos's damage taken are about 2% too high.

- [ ] Turn 18, line 84: Genghis Zong goes to 0 ('0 fnt') with no faint and comes back at 2% (line 171): the HP is misread
- [ ] Turn 16, line 145: Archaludon takes 'Mind Blown' damage but stays at 92%: the HP is misread

## Week 8: chicken parm karm vs FingerStripes (`video-x2mvt-7opzc`, 23 turns)
Video: https://youtu.be/X2MvT-7opZc

- Nothing found.

## Week 8: pee nation vs doxsego (`video-bfmitcpowya`, 24 turns)
Video: https://youtu.be/BFmITCpOwYA

- [ ] Turn 3, line 41: p2 (Photo Bomber) did nothing this turn: a move or 'can't move' line may be missing
- [ ] Turn 19, line 174: Gargle deez loses HP with no move before it: the attack line is missing or misread

## Week 8: azpmCloudburst vs Zololab (`video-hdoj_rkuoiw`, 24 turns)
Video: https://youtu.be/Hdoj_RkUOiw

- Nothing found.
