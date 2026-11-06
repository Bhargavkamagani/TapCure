/**
 * Health awareness articles for /health-articles.
 *
 * Written in-house on purpose. This is a healthcare product and the Medical
 * Disclaimer promises TapCure does not give medical advice — piping an
 * uncontrolled third-party health feed onto a hospital-facing site works against
 * that, because nobody would review what appeared.
 *
 * Rules these follow, and any new one must too:
 *   - general awareness only: what a condition is, why it matters, what to
 *     watch for. Never a diagnosis, a dose, or a treatment plan.
 *   - no numeric thresholds. "Your doctor confirms it with repeat readings"
 *     ages better than a number that varies by guideline and by patient.
 *   - every article ends by pointing at a doctor, not at the app.
 *
 * `seeDoctor` is rendered as its own highlighted line — the part that matters
 * most is the part a reader should still see if they skim everything else.
 */
export const HEALTH_ARTICLES = [
  {
    tag: 'Heart Health',
    title: 'High Blood Pressure: Why They Call It the Silent One',
    blurb: 'It usually causes no symptoms at all — which is exactly what makes it worth checking.',
    minutes: 3,
    body: [
      'Blood pressure is the force of blood pushing against the walls of your arteries. When it stays high over months and years, the heart works harder than it should and the vessels take damage — quietly, without pain or any obvious sign.',
      'That is the difficulty with it. Most people with high blood pressure feel completely well, and find out only when it is measured for something else. Headaches and giddiness are far more often something other than blood pressure, and waiting to feel unwell is not a way to catch it.',
      'It is measured in a minute, costs almost nothing, and is not diagnosed from a single reading — a doctor confirms it over repeated measurements, often on more than one visit, because a single high reading can simply mean you climbed stairs or were anxious.',
      'What helps is unglamorous and well established: less salt, more movement, keeping weight in a healthy range, less alcohol, no smoking, and sleep. Where medicine is prescribed it is usually long-term, and stopping because you feel fine is the most common way people lose the benefit.',
    ],
    seeDoctor: 'Get it checked at any visit, particularly if a parent or sibling has it. Chest pain, breathlessness, sudden weakness on one side, or trouble speaking need emergency care immediately.',
  },
  {
    tag: 'Diabetes',
    title: 'Type 2 Diabetes: The Early Signs People Explain Away',
    blurb: 'Thirst, tiredness and frequent urination get blamed on the weather far more often than they should be.',
    minutes: 3,
    body: [
      'In type 2 diabetes the body still makes insulin but stops responding to it properly, so sugar stays in the blood instead of moving into cells. It builds slowly, often over years, and the early stretch is where it is easiest to act.',
      'The signs are easy to dismiss because each one has an innocent explanation: passing urine more often, being thirsty a lot, tiredness that does not lift, blurred vision, cuts that heal slowly, unexplained weight loss. Any of them on their own may be nothing. Together, or persisting, they are worth a blood test.',
      'Risk is higher if a close relative has diabetes, if you carry extra weight around the middle, if you sit most of the day, or if you had diabetes during a pregnancy. South Asians tend to develop it younger and at lower body weights than many other populations, so "I am not overweight" is not a reason to skip the test.',
      'It is manageable, and manageable early is far easier than managed late. Diet, activity and — when a doctor decides it is needed — medication all work, and the checks that come with it (eyes, feet, kidneys) exist to catch complications long before they are felt.',
    ],
    seeDoctor: 'Ask for a blood sugar test if these signs persist, or if diabetes runs in your family. Confusion, drowsiness, vomiting or very fast breathing in someone with diabetes is an emergency.',
  },
  {
    tag: 'Child Health',
    title: 'Fever in Children: What Actually Needs a Doctor',
    blurb: 'The number on the thermometer matters less than how the child looks and behaves.',
    minutes: 3,
    body: [
      'Fever is not an illness. It is the body responding to one, usually an infection, and usually one the child will fight off. That is why experienced doctors ask less about the reading and more about the child.',
      'What is reassuring: drinking fluids, passing urine normally, alert between temperature spikes, playing even if less than usual. What is not: refusing fluids, unusually drowsy or difficult to wake, breathing fast or struggling, a rash that does not fade when pressed, a stiff neck, or a fever that keeps returning over several days.',
      'Age changes the threshold. In a baby under three months, any fever is a reason to be seen the same day, regardless of how well they seem.',
      'For comfort, fluids and rest do most of the work. Any medicine for fever should be given at the dose your doctor or pharmacist sets for that child, by weight — never a share of an adult tablet, and never aspirin for a child.',
    ],
    seeDoctor: 'Any fever under three months of age, difficulty breathing, a non-fading rash, a fit or seizure, refusing to drink, or a child who is unusually drowsy — go now, do not wait.',
  },
  {
    tag: 'Medicines',
    title: 'Why Finishing the Antibiotic Course Matters',
    blurb: 'Feeling better is not the same as being clear of the infection.',
    minutes: 2,
    body: [
      'Antibiotics kill bacteria. They do nothing at all against viruses, which is why they will not help an ordinary cold or most sore throats — and why a doctor declining to prescribe one is often the correct treatment, not a lesser one.',
      'When they are prescribed, symptoms usually settle before the bacteria are gone. Stopping there leaves the hardiest behind, and those are the ones that go on to multiply. Repeated across a population, this is how infections stop responding to the medicines that used to treat them.',
      'Two habits matter as much as finishing: never take antibiotics left over from a previous illness, and never take someone else\'s. The right antibiotic depends on the organism, the site of infection and the person, and leftovers are almost never the right one or a full course.',
    ],
    seeDoctor: 'Take the full course as prescribed. If it makes you unwell — a rash, swelling, severe diarrhoea, or breathing difficulty — stop and contact your doctor straight away.',
  },
  {
    tag: 'Women’s Health',
    title: 'Anaemia: Common, Treatable, and Often Ignored',
    blurb: 'Constant tiredness gets accepted as normal life far more often than it should be.',
    minutes: 2,
    body: [
      'Anaemia means too few healthy red blood cells to carry oxygen around the body. It is very common in India, particularly among women and adolescent girls, and it is one of the more straightforward things to find and to treat.',
      'It shows up as tiredness that rest does not fix, breathlessness on stairs that used to be easy, giddiness, palpitations, pale skin, brittle nails, or difficulty concentrating. Because it comes on gradually, people adjust to it and stop noticing — which is why it is so often picked up on a test done for another reason.',
      'The cause matters as much as the count. Diet is one cause; heavy periods, pregnancy, ulcers, worm infestation and some long-term conditions are others, and treating the anaemia without finding the reason means it returns.',
      'Iron supplements should come from a doctor rather than a shop shelf. Too much iron is harmful, and iron will not fix anaemia that has a different cause.',
    ],
    seeDoctor: 'Ask for a simple blood test if tiredness has been going on for weeks. Chest pain, fainting, or breathlessness at rest need urgent care.',
  },
  {
    tag: 'Prevention',
    title: 'Mosquito-Borne Fevers: The Week That Matters',
    blurb: 'Dengue, malaria and chikungunya share a season, a mosquito, and a warning sign people miss.',
    minutes: 3,
    body: [
      'These illnesses arrive with the rains, and most cases recover with rest and fluids. The reason they are taken seriously is that a small number turn severe — and dengue does so at a point that feels like recovery.',
      'In dengue, the dangerous phase often begins as the fever falls, around the third to seventh day. Someone who seemed to be improving becomes worse: severe stomach pain, repeated vomiting, bleeding from the gums or nose, black stools, restlessness, cold clammy skin. That combination needs hospital care immediately, not observation at home.',
      'Prevention is the mosquito, not the medicine. The species that spreads dengue breeds in clean standing water and bites during the day — so it is coolers, flower pots, tyres, water drums and terrace containers that matter, emptied and scrubbed weekly rather than merely covered.',
      'One caution on treatment: for any fever that could be dengue, avoid painkillers such as aspirin or ibuprofen unless a doctor has said otherwise, because they can worsen bleeding. Ask your doctor what is safe to take.',
    ],
    seeDoctor: 'Any fever lasting more than two days in a dengue or malaria season deserves a test. Bleeding, severe abdominal pain, persistent vomiting or drowsiness is an emergency.',
  },
  {
    tag: 'Prevention',
    title: 'Tuberculosis: A Cough That Outstays Two Weeks',
    blurb: 'Still one of India’s biggest infectious killers, and still curable when it is found.',
    minutes: 3,
    body: [
      'TB is a bacterial infection that most often settles in the lungs, spreading through the air when someone with untreated lung TB coughs or sneezes. It is curable, and treatment is free at government facilities — but only once someone comes forward to be tested.',
      'The sign that matters most is duration. A cough lasting more than two weeks deserves a test, particularly alongside fever in the evenings, night sweats, losing weight without trying, or coughing blood.',
      'Treatment runs for months, and the trap is the same one antibiotics have: people feel well long before the bacteria are gone. Stopping early is how ordinary TB becomes drug-resistant TB, which is far harder and far longer to treat.',
      'If someone at home has TB, the household usually needs screening too — including children, who can carry it without the classic cough.',
    ],
    seeDoctor: 'A cough lasting more than two weeks, or any coughing of blood, should be tested — do not wait for it to settle on its own.',
  },
  {
    tag: 'Mental Health',
    title: 'Sleep, Stress and Low Mood: When It Is More Than a Rough Patch',
    blurb: 'Feeling low sometimes is human. Feeling low for weeks is worth talking to someone about.',
    minutes: 3,
    body: [
      'Low mood, poor sleep and constant worry get treated as ordinary life almost everywhere, and often they are. What separates a rough patch from something needing help is how long it lasts and how much it takes from you.',
      'Two weeks is a rough guide. If most days for two weeks or more you have felt low or lost interest in things you normally enjoy — and it is affecting sleep, appetite, work, or the people around you — that is worth raising with a doctor.',
      'It often shows up physically first: headaches, stomach trouble, exhaustion, aches with no clear cause. People frequently arrive at a hospital for those symptoms without connecting them to how they have been feeling.',
      'This is a medical condition, not a weakness or a character failing, and it responds to treatment. A family doctor is a perfectly good place to start.',
    ],
    seeDoctor: 'Two weeks or more of low mood, or sleep that will not settle, is worth a consultation. If you are thinking of harming yourself, treat it as an emergency and tell someone today.',
  },
  {
    tag: 'Prevention',
    title: 'Vaccines: Keeping Track of What Is Due',
    blurb: 'Childhood schedules are only half of it — adults need some too.',
    minutes: 2,
    body: [
      'Vaccines work by teaching the body to recognise an infection before it meets it for real. Childhood schedules are designed to arrive ahead of the ages at which each illness is most dangerous, which is why timing matters as much as the vaccine itself.',
      'A missed dose is not a lost cause. Schedules can almost always be caught up, and a doctor can plan that without starting over — so a delayed vaccination is worth asking about rather than abandoning.',
      'Adults get forgotten. Tetanus cover after a dirty wound, the vaccines advised during pregnancy, and those recommended for older adults or people with long-term conditions all have their place.',
      'Keep the card. A written record — or a photo of it on your phone — saves guesswork at every future visit, and is often asked for at school admission.',
    ],
    seeDoctor: 'Ask your doctor to check the schedule if a dose was missed, before travel, during pregnancy, or after a wound from something rusty or dirty.',
  },
  {
    tag: 'Heart Health',
    title: 'Chest Pain: The One Symptom Not to Wait Out',
    blurb: 'Most chest pain is not a heart attack. The cost of guessing wrong is what makes it different.',
    minutes: 2,
    body: [
      'Chest pain has many causes — acidity, muscle strain, anxiety, infection. Most are not dangerous. But treatment for a heart attack works best in the first hour or two, so this is one symptom where waiting to see is the wrong instinct.',
      'Worrying features: heaviness, pressure or squeezing in the centre of the chest, pain spreading to the arm, jaw, neck or back, sweating, nausea, breathlessness, or pain that comes on with exertion and eases with rest.',
      'It does not always look dramatic. In women, in older people and in those with diabetes, a heart attack can present as unusual tiredness, indigestion-like discomfort or breathlessness, with no crushing pain at all.',
      'If you suspect one: call for emergency help, go to the nearest hospital that can treat it, and do not drive yourself.',
    ],
    seeDoctor: 'Chest pain with sweating, breathlessness, vomiting, or pain spreading to the arm or jaw is an emergency. Go immediately — do not wait for it to pass.',
  },
  {
    tag: 'Nutrition',
    title: 'Water, Heat and the Summer Nobody Plans For',
    blurb: 'Heat illness builds quietly across a day, and it is almost entirely preventable.',
    minutes: 2,
    body: [
      'Working or travelling through the hottest part of an Indian summer day puts real strain on the body. Heat exhaustion arrives first — heavy sweating, weakness, headache, nausea, cramps, dizziness — and it is the warning, not the illness.',
      'Heat stroke is the emergency it becomes: very high body temperature, confusion or strange behaviour, and sometimes skin that has stopped sweating. It damages organs and needs hospital care immediately, while the person is cooled on the way.',
      'Prevention is dull and effective: drink through the day rather than only when thirsty, keep the hardest work away from the afternoon peak, rest in shade, and wear light loose clothing. Plain water and ORS do more than sweet drinks.',
      'The people at most risk are the ones least likely to complain — infants, older adults, pregnant women, outdoor workers, and anyone on regular medication for heart or kidney conditions.',
    ],
    seeDoctor: 'Confusion, fainting, a very high temperature, or someone who stops sweating in the heat is an emergency. Move them to shade, start cooling, and get help immediately.',
  },
  {
    tag: 'Women’s Health',
    title: 'Antenatal Check-ups: What They Are Actually Looking For',
    blurb: 'The visits when you feel completely well are the ones that catch the most.',
    minutes: 3,
    body: [
      'Antenatal care is routine surveillance, not treatment. Most of what it looks for causes no symptoms at the stage when it is easiest to manage — which is precisely why the schedule exists.',
      'Blood pressure and urine are checked for pre-eclampsia, which can develop with no warning signs at all. Blood tests look for anaemia, blood group, sugar levels and infections that affect a baby. Growth and heartbeat are followed to see how the pregnancy is progressing.',
      'Iron, folic acid and calcium are usually advised, and vaccination is planned. None of this depends on feeling unwell, and skipping a visit because the pregnancy feels fine is skipping exactly the check designed for that.',
      'Between visits, some symptoms should never wait for the next appointment.',
    ],
    seeDoctor: 'Bleeding, severe or constant headache, blurred vision, severe abdominal pain, high fever, sudden swelling of the face or hands, or reduced baby movements — get seen the same day.',
  },
]
