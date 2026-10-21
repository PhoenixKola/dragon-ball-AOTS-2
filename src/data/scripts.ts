import type { Step } from '../engine/world/mapTypes';

/** Interactive story + NPC scripts. Triggers/entities in maps.ts reference these ids. */
export const SCRIPTS: Record<string, Step[]> = {
  // ===================== PROLOGUE / CH1: STRANGERS ON NAMEK =====================
  shore_ship: [
    { if: { flag: 'scouts1' }, then: [
      { say: [['Bulma', 'The ship is fine. I will keep the engines warm. Find the Dragon Balls, boys, and be careful!'], ['Krillin', 'We will. Try not to let anyone scrap the ship while we are gone.']] },
      { heal: true }, { toast: 'Bulma patched you up.' },
      { say: [['Bulma', 'Want me to check the Dragon Radar for you while you are here?']] },
      { radar: 'Bulma' },
      { if: { flag: 'piccolo_joined' }, then: [{ say: [['Bulma', 'Piccolo and Nail in one body? Namek is stranger every hour. Please come back in one piece.']] }] },
    ], else: [{ say: [['Bulma', 'Namek’s air is breathable. The dragon radar is picking up something to the east, past that long path.'], ['Gohan', 'And I can feel a lot of strong power. Not friendly power.'], ['Bulma', 'Then stay together. Check the crates around here for supplies.']] }] },
  ],
  shore_fisher: [
    { if: { flag: 'qd:shore_net' }, then: [{ say: [['Namekian', 'The sea is quiet again, thanks to you. May your road be safe.']] }], else: [
      { if: { flag: 'q:shore_net' }, then: [
        { if: { flag: ['foe:shore_foe1', 'qp:shore_sack'] }, then: [
          { say: [['Namekian', 'My sack! And the soldiers are gone. You have my deepest thanks.'], ['Krillin', 'Medicine and beans, right? Looks like they never opened it.'], ['Namekian', 'Take a bean. You need it more than I do.']] },
          { quest: { id: 'shore_net', do: 'complete' } },
        ], else: [{ say: [['Namekian', 'The scouts pace the beach to the east with my supplies. Once they are gone, my sack should be lying in the sand nearby.']] }] },
      ], else: [
        { if: { flag: 'scouts1' }, then: [
          { say: [['Namekian', 'Travellers… the soldiers took my supplies and now they patrol the beach where I used to fish.'], ['Gohan', 'We will see what we can do.']] },
          { quest: { id: 'shore_net', do: 'start' } },
        ], else: [{ say: [['Namekian', 'You are not from here. Others like you came: tall, cruel. They took from my neighbours.'], ['Gohan', 'Frieza’s soldiers?'], ['Namekian', 'Follow the path east to Aojan. Be careful: they patrol it.']] }] },
      ] },
    ] },
  ],
  shore_sack: [
    { say: [['Narrator', 'A battered sack lies half buried in the sand, the fisher’s mark stitched on its side.']] },
    { set: 'qp:shore_sack' }, { toast: 'Recovered the fisher’s sack. Take it back to him.' },
  ],
  shore_scouts: [
    { say: [['Scout', 'Halt! By order of Lord Frieza, all Dragon Balls on this planet belong to the Emperor!'], ['Krillin', 'We have been here ten minutes and we are already being shot at.'], ['Gohan', 'Krillin, stay behind me. I will try the Masenko.'], ['Narrator', 'TIP: Enemy attacks show a closing ring on the targeted fighter. Press that fighter’s number key (1, 2 or 3) as the ring closes to Active Guard.']] },
    { battle: { foes: ['scout', 'scout'], title: 'First Contact', tutorial: true, allowFlee: false, party: ['gohan', 'krillin'] }, win: [{ set: 'scouts1' }, { chapter: 1 }, { say: [['Krillin', 'Phew. One of them had a map. Aojan village is just east of here.'], ['Gohan', 'Then that is where we go.']] }] },
  ],
  // ===================== VILLAGE =====================
  village_kid: [
    { if: { flag: 'qd:grotto_child' }, then: [{ say: [['Namekian child', 'My brother is home and he will not stop telling everyone how brave he was!']] }], else: [
      { if: { flag: 'q:grotto_child' }, then: [
        { if: { flag: 'qp:grotto_child_found' }, then: [
          { say: [['Namekian child', 'He is back?! He told me you found him in the cave. Thank you, thank you!'], ['Gohan', 'Tell him to stay out of the grotto for a while.']] },
          { quest: { id: 'grotto_child', do: 'complete' } },
        ], else: [{ say: [['Namekian child', 'He went east with the soldiers’ trail. I think he hid in the crystal cave past the camp.']] }] },
      ], else: [
        { if: { flag: 'dodoria_done' }, then: [
          { say: [['Namekian child', 'Please, my little brother followed the soldiers east and has not come back!'], ['Krillin', 'East… the camp and the cave behind it? We were just there.'], ['Namekian child', 'He likes the shiny rocks. Maybe he hid in the crystal cave?']] },
          { quest: { id: 'grotto_child', do: 'start' } },
        ], else: [
          { if: { flag: 'dende_met' }, then: [{ say: [['Namekian child', 'Dende is back! You are the ones who chased the soldiers away, right?']] }], else: [{ say: [['Namekian child', 'Are you friends of Dende? The soldiers took him toward the big house!']] }] },
        ] },
      ] },
    ] },
  ],
  village_elder_story: [
    { if: { flag: 'qd:aojan_medicine' }, then: [{ say: [['Namekian', 'The elders are resting easier. The altar in the heart of the village will keep your journey safe.']] }], else: [
      { if: { flag: 'q:aojan_medicine' }, then: [
        { if: { has: { medkit: 2 } }, then: [
          { say: [['Namekian', 'Two Med Kits! You even brought them without being asked twice.'], ['Gohan', 'It is the least we can do.'], ['Namekian', 'Take this capsule: it holds the strength of the elders’ gratitude.']] },
          { take: { medkit: 2 } },
          { quest: { id: 'aojan_medicine', do: 'complete' } },
        ], else: [{ say: [['Namekian', 'We need two Med Kits. The trader by the road sells them if you are short.']] }] },
      ], else: [
        { if: { flag: 'dende_met' }, then: [
          { say: [['Namekian', 'The raids left our elders weak. If you could spare two Med Kits, it would mean the world to us.'], ['Gohan', 'We will bring them.']] },
          { quest: { id: 'aojan_medicine', do: 'start' } },
        ], else: [{ say: [['Namekian', 'We keep our Dragon Ball in the altar at the heart of the village. Touch it to record your journey; many of us trust it to watch over travellers.']] }] },
      ] },
    ] },
  ],
  village_shop: [
    { if: { flag: 'qd:camp_bounty' }, then: [{ say: [['Trader', 'Fewer patrols on the road and my carts are moving again. Anything you need is on the shelf.']] }], else: [
      { if: { flag: 'q:camp_bounty' }, then: [
        { if: { flag: ['foe:landing_foe1', 'foe:landing_foe2'] }, then: [
          { say: [['Trader', 'Both patrols gone? I told you I pay well. Here is the bounty and a little something extra.']] },
          { quest: { id: 'camp_bounty', do: 'complete' } },
        ], else: [{ say: [['Trader', 'The bounty stands: the camp patrol and the elite patrol at the Landing Zone. Come back when both are down.']] }] },
      ], else: [
        { if: { flag: 'dodoria_done' }, then: [
          { say: [['Trader', 'You cut down Dodoria? Then you can handle the patrols around Frieza’s camp too. I will pay for each one.'], ['Vegeta', 'Pay in zeni, then. Not in conversation.']] },
          { quest: { id: 'camp_bounty', do: 'start' } },
        ], else: [{ say: [['Trader', 'Zeni for supplies? Ha, I have been trading with Namekians for years. I will deal with strangers too.']] }] },
      ] },
    ] },
    { shop: 'village' },
  ],
  village_enter: [
    { say: [['Scout', 'Come out, little green freak! Where is the Dragon Ball? We will burn this village down!'], ['Dende', 'Please… I cannot let you have it.'], ['Gohan', 'Leave him alone!']] },
    { battle: { foes: ['scout', 'guard'], title: 'Defend Dende', allowFlee: false, party: ['gohan', 'krillin'] }, win: [
      { set: 'dende_met' },
      { say: [['Dende', 'You saved me! I am Dende. Frieza’s men are taking our Dragon Balls one by one.'], ['Krillin', 'That is exactly why we came.'], ['Dende', 'Take this one. Our elders say the Dragon Balls should only be used for good. Please protect it.']] },
      { ball: 1 },
      { say: [['Gohan', 'We will. Where are the others?'], ['Dende', 'Frieza’s soldiers landed east of here. Something is heading there that is even stronger than they are.']] },
      { give: { medkit: 2 } },
    ] },
  ],
  dende_talk: [
    { if: { flag: 'piccolo_joined' }, then: [{ say: [['Dende', 'I will heal you if I can. Please be careful.']] }, { heal: true }, { toast: 'Dende healed the party.' }], else: [{ say: [['Dende', 'Namekian dragon balls grant three wishes. If they fall to Frieza, he becomes immortal.'], ['Dende', 'Let me heal you.']] }, { heal: true }, { toast: 'Dende healed the party.' }] },
    { say: [['Dende', 'I can also feel where the Dragon Balls are, if you want to know.']] },
    { radar: 'Dende' },
  ],
  // ===================== CH2: THE PRINCE RETURNS =====================
  vegeta_arrive: [
    { chapter: 2 },
    { say: [['Vegeta', 'Out of my way. Frieza will not get his hands on those Dragon Balls.'], ['Krillin', 'Vegeta?! What are you doing here?'], ['Vegeta', 'The same thing you are, you fool. I intend to use them first.'], ['Gohan', 'Then we are on the same side for now.'], ['Vegeta', 'Do not mistake a truce for friendship, boy.']] },
    { join: 'vegeta', level: 0 }, { set: ['vegeta_arrived', 'vegeta_joined'] }, { unlockCombo: 'vegeta_krillin' },
    { toast: 'Vegeta joined the party' },
  ],
  cui_fight: [
    { say: [['Cui', 'Vegeta! Lord Frieza has ordered me to dispose of you. And your little friends.'], ['Vegeta', 'Fool. I used to carry people like you on my back.'], ['Narrator', 'Cui will reflect any physical attack. Use Ki techniques!']] },
    { battle: { foes: ['cui', 'guard'], title: 'Cui', party: ['gohan', 'krillin', 'vegeta'], intro: 'Cui braces to reflect physical attacks. Ki techniques pass straight through.' }, win: [{ set: 'cui_done' }, { say: [['Vegeta', 'Pathetic. One of Frieza’s elite? He is no more than a toy.'], ['Krillin', 'The path east is open. Dodoria will be waiting.']] }] },
  ],
  dodoria_fight: [
    { say: [['Dodoria', 'Well, well. A monkey and a few insects. Lord Frieza will be so entertained.'], ['Vegeta', 'Dodoria. You are going to wish you stayed in the ship.'], ['Narrator', 'Dodoria winds up Mach Crush: defend or guard the heavy blow.']] },
    { battle: { foes: ['dodoria'], title: 'Dodoria', party: ['gohan', 'krillin', 'vegeta'], theme: 'boss' }, win: [{ set: ['dodoria_done'] }, { chapter: 2 }, { say: [['Vegeta', 'One less. Now I will take the Dragon Ball you are hiding in that cave.'], ['Krillin', 'The cave is east of here. Let us go before more soldiers arrive.']] }] },
  ],
  cave_child: [
    { say: [['Namekian child', 'Who… who is there? Did the soldiers send you?'], ['Krillin', 'No, no. Your brother in the village sent us. He is worried sick.'], ['Namekian child', 'I only came to look at the crystals! Then I heard the big soldiers and hid. Please tell him I am coming home.']] },
    { set: 'qp:grotto_child_found' }, { toast: 'Found the lost child. Tell his brother in Aojan Village.' },
  ],
  hold_logbook: [
    { if: { flag: 'qd:ship_logbook' }, then: [{ say: [['Narrator', 'The order log lies empty now. You already took what mattered.']] }], else: [
      { say: [['Narrator', 'A scorched order log rests under a console, a list of Namekian villages and dates crossed out one by one.'], ['Gohan', 'He is tracking the Dragon Balls village by village. And Guru is on the list.'], ['Krillin', 'Let us copy this. The Guru should see it.']] },
      { set: 'qp:logbook' },
      { quest: { id: 'ship_logbook', do: 'start' } },
    ] },
  ],
  ball2_pick: [{ say: [['Krillin', 'There it is! The second Dragon Ball.'], ['Vegeta', 'Give it to me.'], ['Gohan', 'We will carry it. Together.']] }, { ball: 2 }],
  zarbon_fight: [
    { say: [['Zarbon', 'Such a beautiful world. And such unattractive visitors. Surrender the Dragon Balls to Lord Frieza.'], ['Vegeta', 'Zarbon… I will wipe that smirk off your face.'], ['Gohan', 'Watch out. His power keeps rising!']] },
    { battle: { foes: ['zarbon'], title: 'Zarbon', party: ['gohan', 'krillin', 'vegeta'], theme: 'boss', intro: 'Zarbon grows stronger at half health. He will transform.' }, win: [{ set: 'zarbon_done' }, { say: [['Zarbon', 'I… was Lord Frieza’s most trusted…'], ['Krillin', 'He is down. And so is the road to the Guru!'], ['Gohan', 'Let us go north before more of them show up.']] }] },
  ],

  // ===================== CH3: GURU =====================
  guru_scene: [
    { chapter: 3 },
    { say: [['Guru', 'Come closer, children. I can feel the weight of your hearts.'], ['Gohan', 'Elder Guru… Dende told us about you.'], ['Guru', 'Frieza will come for me soon. But before he does, let me unlock the power sleeping inside you.']] },
    { training: 6 }, { heal: true },
    { say: [['Guru', 'There. Your potential is open. Use it to protect life.'], ['Krillin', 'Whoa. That is a lot of power…'], ['Vegeta', 'Hm. I can feel it too.'], ['Guru', 'Take the Dragon Ball my people kept in our care. And trust Nail, my strongest warrior, to guard you.']] },
    { set: ['guru_done', 'nail_known'] }, { give: { senzu: 2, ragecap: 1 } }, { toast: 'Potential unlocked: +6 training points each' },
  ],
  guru_talk: [
    { if: { flag: 'qd:ship_logbook' }, then: [{ say: [['Guru', 'The names in that log will not be forgotten. Go with a clear heart.']] }], else: [
      { if: { flag: 'qp:logbook' }, then: [
        { say: [['Guru', 'You bring me Frieza’s own hand. Let me see… yes. He sends his soldiers to every village, but his true target was always this Sanctuary.'], ['Guru', 'Knowing his plan frees you from guessing. Let me unlock a little more of what sleeps inside you.']] },
        { quest: { id: 'ship_logbook', do: 'complete' } },
      ], else: [
        { if: { flag: 'ginyu_done' }, then: [{ say: [['Guru', 'The Ginyu Force is broken, yet I feel something far darker approaching. Be ready.']] }], else: [{ say: [['Guru', 'Use your gifts well. Nail is outside; ask him to train with you if you wish.']] }] },
      ] },
    ] },
  ],
  ball3_pick: [{ say: [['Dende', 'Take this one too. The sacred ball must not fall to Frieza.']] }, { ball: 3 }],
  ball4_pick: [{ say: [['Goku', 'That glow, up in the rocks. It is a Dragon Ball!'], ['Vegeta', 'The Ginyu Force must have been guarding it. Take it.']] }, { ball: 4 }],
  ball5_pick: [{ say: [['Krillin', 'A Dragon Ball in a supply locker? Frieza really is collecting them.'], ['Vegeta', 'Not any more. It is ours now.']] }, { ball: 5 }],
  ball6_pick: [{ say: [['Piccolo', 'Frieza dropped something when he left the camp.'], ['Gohan', 'Another Dragon Ball! Only one more.']] }, { ball: 6 }],
  ball7_pick: [{ say: [['Narrator', 'Half buried in the rubble, the last Dragon Ball still glows faintly.'], ['Piccolo', 'That is the seventh. Take it, Goku. Then finish this.']] }, { ball: 7 }],
  nail_talk: [
    { if: { flag: 'piccolo_joined' }, then: [{ say: [['Narrator', 'Nail’s spirit lives on within Piccolo.']] }], else: [
      { if: { flag: 'qd:nail_hold' }, then: [{ say: [['Nail', 'The guards in the hold will not bother us again. Stay sharp: Frieza’s elite warriors, the Ginyu Force, are coming.']] }], else: [
        { if: { flag: 'q:nail_hold' }, then: [
          { if: { flag: ['foe:hold_foe1', 'foe:hold_foe2'] }, then: [
            { say: [['Nail', 'Both patrols are gone? Good. A warrior who cannot clear a hallway cannot guard a Guru. Take this.']] },
            { quest: { id: 'nail_hold', do: 'complete' } },
          ], else: [{ say: [['Nail', 'The guards in Frieza’s ship hold, both patrols. They stand east of the camp, up the ramp.']] }] },
        ], else: [
          { say: [['Nail', 'I am Nail. I will protect Guru and the people, whatever it takes.'], ['Nail', 'Before the Ginyu Force reaches us I want Frieza’s ship hold cleared. Two patrols walk its floor. Will you deal with them?']] },
          { quest: { id: 'nail_hold', do: 'start' } },
        ] },
      ] },
    ] },
  ],
  // ===================== CH4: GINYU FORCE =====================
  ridge_hurt: [
    { if: { flag: 'qd:ridge_ambush' }, then: [{ say: [['Namekian', 'Thank you again. That soldier will not trouble us any more.']] }], else: [
      { if: { flag: 'ridge_helped' }, then: [
        { if: { flag: 'foe:ridge_foe1' }, then: [
          { say: [['Namekian', 'The ambush party is gone! You are as kind as you are strong.'], ['Gohan', 'Stay safe. And take these.']] },
          { quest: { id: 'ridge_ambush', do: 'complete' } },
        ], else: [{ say: [['Namekian', 'Please be careful. The ambush party still walks the northern grass.']] }] },
      ], else: [
        { say: [['Namekian', 'Please… soldiers ambushed our group. One party still lurks in the northern grass.'], ['Krillin', 'We will take care of it.']] },
        { quest: { id: 'ridge_ambush', do: 'start' } },
      ] },
    ] },
  ],
  guldo_fight: [
    { chapter: 4 },
    { say: [['Guldo', 'Hold it right there! The Ginyu Force’s Guldo has found you.'], ['Krillin', 'Ginyu Force? Those elites Frieza brags about?'], ['Guldo', 'I will hold my breath and stop time to make this very easy!'], ['Narrator', 'Guldo charges Time Freeze: hit him hard for 16% of his health in one turn to interrupt it.']] },
    { battle: { foes: ['guldo'], title: 'Guldo', party: ['gohan', 'krillin', 'vegeta'], theme: 'ginyu', intro: 'Guldo is charging Time Freeze. Break his focus with a heavy blow!' }, win: [{ set: 'guldo_done' }, { say: [['Vegeta', 'The runt. One down.'], ['Gohan', 'But the others… I can feel them. They are much stronger than him.']] }] },
  ],
  recoome_fight: [
    { say: [['Recoome', 'Hee hee, nice try with Guldo! Now it is time for the Recoome Special!'], ['Vegeta', 'Enough posing. Fight.']] },
    { battle: { foes: ['recoome'], title: 'Recoome', party: ['gohan', 'krillin', 'vegeta'], surviveRounds: 5, noGameOver: true, allowFlee: false, theme: 'ginyu', intro: 'Survive! Help may be on the way.' }, win: [
      { say: [['Recoome', 'Hee hee hee! Is that all? You are only warming me up!'], ['Krillin', 'We cannot beat him… he is too strong.'], ['Gohan', 'Wait. That energy… Dad?!'], ['Narrator', 'A familiar power rises over the horizon.'], ['Goku', 'Sorry I am late, everybody! It took a while to get here.']] },
      { join: 'goku', level: 0 }, { party: ['goku', 'vegeta', 'gohan'] }, { set: ['goku_joined'] }, { unlockCombo: 'goku_vegeta' }, { toast: 'Goku joined the party' }, { chapter: 4 }, { heal: true },
      { say: [['Vegeta', 'Kakarot… do not think I am grateful.'], ['Goku', 'You can thank me after we beat these guys. Let us show them how it is done.']] },
      { battle: { foes: ['recoome'], title: 'Goku vs Recoome', party: ['goku', 'vegeta', 'gohan'], theme: 'ginyu' }, win: [{ set: 'recoome_done' }, { say: [['Recoome', 'No… no way… I am the strongest…'], ['Goku', 'That is one. Two more to go.']] }] },
    ] },
  ],
  duo_fight: [
    { say: [['Burter', 'The fastest in the universe!'], ['Jeice', 'And the best-looking, too!'], ['Krillin', 'They always talk like that?'], ['Goku', 'Be careful. They work as a pair.']] },
    { battle: { foes: ['burter', 'jeice'], title: 'Burter & Jeice', party: ['goku', 'vegeta', 'gohan'], theme: 'ginyu', intro: 'When both stand, they attack together with Ginyu Pincer. Defeat one to break it.' }, win: [{ set: 'duo_done' }, { say: [['Vegeta', 'Fine. Even a few elite soldiers cannot stop us.'], ['Goku', 'Their captain is the last one. Let us finish this.']] }] },
  ],
  ginyu_fight: [
    { say: [['Ginyu', 'Stop. You are better than any of my underlings. Such power deserves a superior body!'], ['Vegeta', 'What is he talking about?'], ['Goku', 'Be careful! He wants to swap bodies with someone.']] },
    { battle: { foes: ['ginyu'], title: 'Captain Ginyu', party: ['goku', 'vegeta', 'gohan'], theme: 'ginyu', intro: 'At half health Ginyu will steal a fighter’s body: possessed fighters attack their own friends for 3 turns.' }, win: [
      { set: ['ginyu_done'] },
      { say: [['Ginyu', 'N-no! If I cannot have your body, Goku, I will take… the frog!'], ['Narrator', 'In a flash of light, the Captain of the Ginyu Force swaps with a passing frog, and Goku is saved.'], ['Vegeta', 'Pathetic. The Captain, reduced to a frog.'], ['Goku', 'Come on. Let us get back to the Guru. Something big is on its way.']] },
      { toast: 'The Ginyu Force is finished' },
    ] },
  ],

  // ===================== CH5: THE LAST WISH =====================
  nail_frieza: [
    { chapter: 5 },
    { say: [['Narrator', 'The ground shakes. A frightening presence lands at Guru’s Sanctuary.'], ['Frieza', 'Ah, there you are. Where is the elder and his little Dragon Ball?'], ['Nail', 'You will not touch him, Frieza.'], ['Goku', 'Nail, wait! He is too strong!'], ['Nail', 'Go. Protect the Dragon Balls. I will hold him as long as I can.']] },
    { battle: { foes: ['frieza1'], title: 'Nail vs Frieza', party: ['nail', 'gohan', 'krillin'], surviveRounds: 4, noGameOver: true, allowFlee: false, theme: 'frieza' }, win: [
      { say: [['Frieza', 'Hmph. A pity. He was almost amusing.'], ['Nail', 'Piccolo… take my power. Fuse… with me…'], ['Narrator', 'Far away, a green warrior feels a power calling him across the planet.'], ['Piccolo', 'Nail… I will carry your will. Hold on.'], ['Narrator', 'Piccolo fuses with Nail, and arrives to fight with the Namekian’s power and will.']] },
      { join: 'piccolo', level: 0, fused: true }, { party: ['gohan', 'piccolo', 'goku'] }, { set: ['piccolo_joined', 'piccolo_fused'] }, { unlockCombo: 'piccolo_gohan' }, { toast: 'Piccolo joined the party (Nail fused)' }, { heal: true },
      { say: [['Piccolo', 'Gohan. I am stronger now. Let us finish this together.'], ['Gohan', 'Mr. Piccolo!']] },
      { warp: { map: 'landing', x: 26, y: 20 } },
    ] },
  ],

  // ===================== CH6: THE TYRANT (Frieza forms) =====================
  frieza_forms: [
    { ask: { text: 'Frieza waits at the heart of the camp. Once you step forward there is no way back: the village, the Sanctuary and every unfinished side quest will be out of reach. Dragon Balls found: {balls}/7. Side quests still open: {quests}. Heal and save at the altar first if you want to. Face Frieza now?', yes: 'Face Frieza', no: 'Not yet', onNo: [{ warp: { map: 'landing', x: 26, y: 21.5 } }] } },
    { chapter: 6 },
    { say: [['Frieza', 'You have been a thorn in my side long enough, little insects.'], ['Vegeta', 'Your reign ends today, Frieza.'], ['Goku', 'We have to stop him here. Everyone, together!']] },
    { battle: { foes: ['frieza1'], title: 'Frieza · First Form', party: ['goku', 'vegeta', 'gohan'], scriptedEnd: { defId: 'frieza1', hpFrac: 0.5 }, theme: 'frieza', intro: 'Frieza is still toying with you.' }, win: [
      { say: [['Frieza', 'Hmph. Perhaps I should take you seriously. Second form!']] },
      { say: [['Dende', 'Hold on, everyone! I can mend some of it!']] }, { restore: 0.5 }, { toast: 'Dende mends half of the party’s wounds.' },
      { battle: { foes: ['frieza2'], title: 'Frieza · Second Form', party: ['goku', 'vegeta', 'piccolo'], scriptedEnd: { defId: 'frieza2', hpFrac: 0.5 }, theme: 'frieza' }, win: [
        { say: [['Frieza', 'Third form, then. You will beg for mercy.'], ['Vegeta', 'Never!']] },
        { say: [['Dende', 'Again! Stay with me!']] }, { restore: 0.5 }, { toast: 'Dende mends half of the party’s wounds.' },
        { battle: { foes: ['frieza3'], title: 'Frieza · Third Form', party: ['vegeta', 'piccolo', 'gohan'], scriptedEnd: { defId: 'frieza3', hpFrac: 0.55 }, theme: 'frieza' }, win: [
          { say: [['Vegeta', 'I… will not be… beaten by this clown!'], ['Narrator', 'Vegeta, exhausted, is brought down by a final blow.'], ['Krillin', 'Vegeta! Hang on!'], ['Vegeta', 'Kakarot… do not… let him…'], ['Narrator', 'Dende carries Vegeta away to safety.']] },
          { leave: 'vegeta' }, { set: ['frieza3_done', 'vegeta_down'] },
          { say: [['Frieza', 'You really did think you could defeat me? My final form will make you regret ever being born.'], ['Krillin', 'This is it. Everyone, hold the line!']] },
        ] },
      ] },
    ] },
  ],
  frieza_final_form: [
    { ask: { text: 'Vegeta has fallen and Frieza is taking his final form. After this fight Namek’s last ground has no way back. Restock and save at the altar if you want to. Continue?', yes: 'Continue', no: 'Prepare first', onNo: [{ warp: { map: 'landing', x: 26, y: 21.5 } }] } },
    { battle: { foes: ['frieza4'], title: 'Frieza · Final Form', party: ['gohan', 'krillin', 'piccolo'], scriptedEnd: { defId: 'frieza4', hpFrac: 0.6 }, theme: 'frieza', intro: 'Frieza’s final form is fast and precise.' }, win: [
      { say: [['Frieza', 'How tedious. I will end your little friend here, so you stop hoping.'], ['Krillin', 'No-'], ['Narrator', 'A single beam of light. Krillin falls.'], ['Gohan', 'KRILLIN!'], ['Piccolo', 'Gohan, no! Do not lose control!']] },
      { leave: 'krillin' }, { set: ['krillin_dead'] }, { chapter: 7 },
      { say: [['Goku', 'Krillin… my best friend… and you… you laughed.'], ['Frieza', 'Of course I did. He was an insect.'], ['Goku', 'I gave you every chance to stop, Frieza. Every one.']] },
      { cutscene: 'ssj' }, { transform: 'ssj' }, { set: 'ssj' }, { party: ['goku', 'gohan', 'piccolo'] },
      { warp: { map: 'core', x: 6, y: 11 } },
    ] },
  ],


  // ===================== POSTGAME: PORUNGA =====================
  porunga_shrine: [
    { say: [['Narrator', 'Seven round stones wait on the shrine, one for each star. The Dragon Balls hum quietly.']] },
    { porunga: true },
  ],
  // ===================== POSTGAME: CAPSULE CORP'S NAMEK SIMULATION =====================
  postgame_comm: [
    { say: [['Bulma', 'Welcome back to the Namek Simulation! The real Namek is gone, but I rebuilt it from your memories and Dende’s ship logs so you can keep training.'], ['Bulma', 'Everything you earned stays with you. Defeated soldiers come back as training dummies. Dragon Balls, chests and rewards do not pay out twice.']] },
    { if: { flag: 'cooler_clue' }, then: [
      { say: [['Bulma', 'The cold signal is still out there, at the east end of the Namek Highlands. Check the frozen rift when you are ready.']] },
    ], else: [
      { say: [['Bulma', 'Hold on. My sensors found a cold energy signature I never programmed. It sits at the east end of the Namek Highlands, past the Ginyu Force’s old ground.'], ['Bulma', 'Whatever it is, it is not part of the simulation. Be careful.']] },
      { set: 'cooler_clue' }, { toast: 'Journal updated: the trail to the unknown signal' },
    ] },
    { ask: { text: 'Run a training simulation now? (three Frost Guards: XP and Zeni, no one-time rewards)', yes: 'Start', no: 'Not now', onNo: [] } },
    { battle: { foes: ['frostguard', 'frostguard', 'frostguard'], title: 'Training Simulation', stage: 'frozen', allowFlee: false, hp: 1, atk: 1 } },
  ],
  cooler_rift: [
    { if: { flag: 'cooler_trail_open' }, then: [
      { say: [['Narrator', 'The frozen rift is open. Cold light spills east into the Frozen Ruins.']] },
    ], else: [
      { if: { flag: 'cooler_clue' }, then: [
        { ask: { text: 'A crack runs through the sky of the simulation. {warn} Open the rift?', yes: 'Open it', no: 'Not yet', onNo: [] } },
        { say: [['Narrator', 'Ice crystals grow along the crack. The air turns bitter cold and the rift peels open like a door.'], ['Piccolo', 'This is not Bulma’s program. There is a power behind it. Enormous, and patient.']] },
        { set: 'cooler_trail_open' }, { toast: 'The rift is open: Frozen Ruins to the east' },
      ], else: [
        { say: [['Narrator', 'Ice crystals jut out of the grass here. Something about them feels wrong. Perhaps Bulma at the Capsule Comm knows what this is.']] },
      ] },
    ] },
  ],
  cooler_comm: [
    { say: [['Bulma', 'You made it into the ruins! The altar behind you saves and heals. Use it before the arena.'], ['Bulma', 'My readings on the big one: his armour hardens (physical hits bounce back, so use Ki), he charges a wide Supernova (break it with a heavy blow or guard), and when he is hurt he builds a Supernova Bomb.']] },
  ],
  cooler_fight: [
    { say: [['Narrator', 'The tall figure waiting in the arena turns: white armour, a violet body, a long tail. The cold deepens.'], ['Cooler', 'So. The monkeys who humbled my little brother wander into MY ruins.']] },
    { ask: { text: '{warn} Face Cooler?', yes: 'Fight', no: 'Not yet', onNo: [{ say: [['Cooler', 'Run along, then. I will wait.']] }, { warp: { map: 'cooler_ruins', x: 31, y: 14 } }] } },
    { battle: { foes: ['cooler'], title: 'Cooler', stage: 'frozen', theme: 'cooler', allowFlee: false, tag: 'cooler', hp: 1, atk: 1, intro: 'Cooler fights in three phases. Frost Armor reflects physical hits: use Ki. Break the Supernova charges or perfect-guard them.' }, win: [
      { set: 'cooler_defeated' },
      { say: [['Cooler', 'Impossible... a monkey... in MY... simulation...'], ['Narrator', 'The ice cracks. Cooler’s armour breaks into blue light and the cold signature fades from the sky.']] },
      { if: { not: 'cooler_reward' }, then: [
        { give: { frostcore: 1, senzu: 3, megakit: 3 } }, { zeni: 2000 }, { set: 'cooler_reward' }, { toast: 'Cooler’s trophy: Frost Core Capsule' },
      ] },
      { say: [['Bulma', 'Signal gone! Fantastic. I left a Training Rematch terminal in the arena: no rewards, but he fights at full strength.']] },
    ] },
  ],
  cooler_rematch: [
    { say: [['Bulma', 'Training rematch terminal. Cooler returns at full strength. No XP, no Zeni, no drops: it is purely for practice and your best clear time.']] },
    { ask: { text: 'Start the Cooler training rematch?', yes: 'Fight', no: 'Not now', onNo: [] } },
    { battle: { foes: ['cooler'], title: 'Cooler · Training Rematch', stage: 'frozen', theme: 'cooler', allowFlee: false, tag: 'cooler', noRewards: true, hp: 1, atk: 1 }, win: [{ say: [['Bulma', 'Rematch cleared. Nicely done!']] }] },
  ],
  // ===================== CH7: THE LEGEND =====================
  to_final: [{ say: [['Goku', 'This is it. Let us go.']] }, { warp: { map: 'core', x: 6, y: 11 } }],
  final_battle: [
    { say: [['Frieza', 'That hair… that aura… impossible. The legendary Super Saiyan?!'], ['Goku', 'I am the Super Saiyan from Planet Vegeta… and your reign of terror is over.'], ['Narrator', 'Namek begins to tear itself apart. This is the final battle.']] },
    { battle: { foes: ['frieza5'], title: 'Frieza · 100% Power', party: ['goku', 'gohan', 'piccolo'], stage: 'final', theme: 'final', allowFlee: false, intro: 'Frieza will gather a Death Ball. Interrupt him or perfect-guard it!' }, win: [
      { set: ['final_done', 'frieza_defeated'] },
      { say: [['Frieza', 'No… I… cannot lose… to a Saiyan…'], ['Goku', 'It is over, Frieza.'], ['Narrator', 'Frieza’s power fades. The ground trembles.']] },
      { run: 'epilogue' },
    ] },
  ],
  epilogue: [
    { say: [['Narrator', 'Namek begins to collapse. The ground splits; the three suns dim.'], ['Gohan', 'Dad! We have to go!'], ['Goku', 'Dende, you got the other Namekians to Earth?'], ['Piccolo', 'Hurry. The ship is waiting. Bulma is here.'], ['Narrator', 'The heroes escape just as Planet Namek is consumed in a blinding flash.']] },
    { if: { flag: ['ball1', 'ball2', 'ball3', 'ball4', 'ball5', 'ball6', 'ball7'] }, then: [
      { say: [['Dende', 'You gathered all seven Dragon Balls! Porunga rose and granted our wish. The Namekians are safe on Earth.'], ['Krillin', '(Somewhere far away, a wish brings a friend back.)']] },
    ], else: [
      { say: [['Dende', 'We never had all seven Dragon Balls together, so Porunga could not be summoned. I got our people into the ships by hand.'], ['Narrator', 'The wishes will have to wait for another day.']] },
    ] },
    { set: ['ending_seen', 'postgame_unlocked'] }, { ending: true },
  ],
};

export const SPEAKER_PORTRAIT: Record<string, string> = {
  Trunks: 'trunks', Porunga: 'dende', Goku: 'goku', Gohan: 'gohan', Krillin: 'krillin', Piccolo: 'piccolo', Vegeta: 'vegeta', Dende: 'dende', Nail: 'nail', Bulma: 'bulma', Cooler: 'cooler', Frieza: 'frieza1', Ginyu: 'ginyu', Jeice: 'jeice', Burter: 'burter',
  Recoome: 'recoome', Dodoria: 'dodoria', Zarbon: 'zarbon', Guldo: 'guldo', Cui: 'cui',
};
