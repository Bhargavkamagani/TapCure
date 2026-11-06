/**
 * Strings for the food guidance under a calculator result (lib/nutritionPlans.js).
 *
 * Foods, quantities, timings and frequencies are each translated ONCE and
 * reused across every plan — see the note in nutritionPlans.js for why.
 */
export const nutritionT = {
  // ---- Section chrome ----
  'nut.heading': { en: "Today's recommendations", te: 'నేటి సిఫార్సులు', hi: 'आज की सिफ़ारिशें' },
  'nut.goalLabel': { en: 'Your goal', te: 'మీ లక్ష్యం', hi: 'आपका लक्ष्य' },
  'nut.reduce': { en: 'Reduce', te: 'తగ్గించండి', hi: 'कम करें' },
  'nut.alt': { en: 'Instead', te: 'బదులుగా', hi: 'इसके बदले' },
  'nut.flow': { en: 'Simple meal flow', te: 'సులభమైన భోజన క్రమం', hi: 'सरल भोजन क्रम' },
  'nut.habit': { en: 'Simple habit', te: 'చిన్న అలవాటు', hi: 'छोटी आदत' },
  'nut.habitText': {
    en: 'Keep regular meal timings, and include vegetables and a protein source in your main meals.',
    te: 'భోజన సమయాలను క్రమం తప్పకుండా పాటించండి, ప్రధాన భోజనాల్లో కూరగాయలు మరియు ఒక ప్రొటీన్ వనరును చేర్చండి.',
    hi: 'भोजन का समय नियमित रखें, और मुख्य भोजन में सब्ज़ियाँ तथा एक प्रोटीन स्रोत ज़रूर शामिल करें।',
  },
  'nut.safety': {
    en: 'General guidance only. If you are pregnant, or living with diabetes, kidney disease or an eating disorder, follow the plan your doctor or dietitian gives you instead.',
    te: 'ఇది సాధారణ మార్గదర్శకత్వం మాత్రమే. మీరు గర్భవతి అయినా, లేదా మధుమేహం, కిడ్నీ వ్యాధి లేదా ఆహార రుగ్మతతో ఉన్నా, మీ డాక్టర్ లేదా డైటీషియన్ ఇచ్చిన ప్రణాళికనే పాటించండి.',
    hi: 'यह केवल सामान्य मार्गदर्शन है। यदि आप गर्भवती हैं, या मधुमेह, गुर्दे की बीमारी या ईटिंग डिसऑर्डर से जूझ रहे हैं, तो अपने डॉक्टर या डाइटीशियन की दी हुई योजना का ही पालन करें।',
  },

  // ---- Plan goals ----
  'nut.goal.gain': { en: 'Healthy weight gain', te: 'ఆరోగ్యకరమైన బరువు పెరుగుదల', hi: 'स्वस्थ तरीके से वज़न बढ़ाना' },
  'nut.goal.gainPlus': { en: 'Healthy weight gain', te: 'ఆరోగ్యకరమైన బరువు పెరుగుదల', hi: 'स्वस्थ तरीके से वज़न बढ़ाना' },
  'nut.goal.maintain': { en: 'Maintain a healthy weight', te: 'ఆరోగ్యకరమైన బరువును నిలబెట్టుకోవడం', hi: 'स्वस्थ वज़न बनाए रखना' },
  'nut.goal.manage': { en: 'Gradual weight management', te: 'క్రమంగా బరువు తగ్గించుకోవడం', hi: 'धीरे-धीरे वज़न प्रबंधन' },
  'nut.goal.bodyfat': { en: 'Lower body fat, keep muscle', te: 'శరీర కొవ్వు తగ్గించి కండరాలను కాపాడుకోవడం', hi: 'शरीर की चर्बी घटाना, मांसपेशियाँ बनाए रखना' },
  'nut.goal.mealplan': { en: 'A balanced day of meals', te: 'సమతుల్య ఆహారంతో కూడిన రోజు', hi: 'संतुलित दिन का खाना' },

  // ---- Plan notes ----
  'nut.note.gain': {
    en: 'Build the extra energy from nutrient-dense food, not junk food.',
    te: 'అదనపు శక్తిని జంక్ ఫుడ్ నుంచి కాకుండా పోషకాలతో కూడిన ఆహారం నుంచి పొందండి.',
    hi: 'अतिरिक्त ऊर्जा जंक फूड से नहीं, पोषक तत्वों से भरपूर भोजन से लें।',
  },
  'nut.note.gainPlus': {
    en: 'Build the extra energy from nutrient-dense food, not junk food.',
    te: 'అదనపు శక్తిని జంక్ ఫుడ్ నుంచి కాకుండా పోషకాలతో కూడిన ఆహారం నుంచి పొందండి.',
    hi: 'अतिरिक्त ऊर्जा जंक फूड से नहीं, पोषक तत्वों से भरपूर भोजन से लें।',
  },
  'nut.note.bodyfat': {
    en: 'Pair this with regular activity — resistance training helps keep muscle while fat comes down.',
    te: 'దీనితో పాటు క్రమం తప్పకుండా వ్యాయామం చేయండి — రెసిస్టెన్స్ ట్రైనింగ్ కొవ్వు తగ్గే సమయంలో కండరాలను కాపాడుతుంది.',
    hi: 'इसके साथ नियमित व्यायाम करें — रेज़िस्टेंस ट्रेनिंग चर्बी घटते समय मांसपेशियाँ बनाए रखने में मदद करती है।',
  },
  'nut.note.bmr': {
    en: 'BMR is only the energy your body uses at rest. What you actually need in a day also depends on your activity level and your goal.',
    te: 'BMR అంటే విశ్రాంతి స్థితిలో మీ శరీరం ఖర్చు చేసే శక్తి మాత్రమే. రోజుకు మీకు నిజంగా అవసరమైనది మీ శారీరక శ్రమ స్థాయి మరియు లక్ష్యంపై కూడా ఆధారపడి ఉంటుంది.',
    hi: 'BMR केवल आराम की स्थिति में आपके शरीर द्वारा उपयोग की गई ऊर्जा है। दिन भर की असली ज़रूरत आपकी गतिविधि और लक्ष्य पर भी निर्भर करती है।',
  },

  // ---- Meal headings (grouped plans) ----
  'nut.meal.breakfast': { en: 'Breakfast', te: 'అల్పాహారం', hi: 'नाश्ता' },
  'nut.meal.midMorning': { en: 'Mid-morning', te: 'ఉదయం మధ్యలో', hi: 'सुबह के बीच' },
  'nut.meal.lunch': { en: 'Lunch', te: 'మధ్యాహ్న భోజనం', hi: 'दोपहर का खाना' },
  'nut.meal.evening': { en: 'Evening', te: 'సాయంత్రం', hi: 'शाम' },
  'nut.meal.dinner': { en: 'Dinner', te: 'రాత్రి భోజనం', hi: 'रात का खाना' },

  // ---- Meal-flow lines (Weight Goal) ----
  'nut.flow.breakfast': { en: 'Breakfast', te: 'అల్పాహారం', hi: 'नाश्ता' },
  'nut.flow.fruit': { en: 'Fruit', te: 'పండు', hi: 'फल' },
  'nut.flow.lunch': { en: 'Lunch', te: 'మధ్యాహ్న భోజనం', hi: 'दोपहर का खाना' },
  'nut.flow.snack': { en: 'Healthy snack', te: 'ఆరోగ్యకరమైన స్నాక్', hi: 'सेहतमंद नाश्ता' },
  'nut.flow.dinner': { en: 'Dinner', te: 'రాత్రి భోజనం', hi: 'रात का खाना' },
  'nut.flow.bigBreakfast': { en: 'Filling breakfast', te: 'కడుపు నిండే అల్పాహారం', hi: 'भरपूर नाश्ता' },
  'nut.flow.fruitNuts': { en: 'Fruit + nuts', te: 'పండు + నట్స్', hi: 'फल + मेवे' },
  'nut.flow.bigLunch': { en: 'Full lunch', te: 'పూర్తి మధ్యాహ్న భోజనం', hi: 'भरपूर दोपहर का खाना' },
  'nut.flow.milkSnack': { en: 'Milk or curd + snack', te: 'పాలు లేదా పెరుగు + స్నాక్', hi: 'दूध या दही + नाश्ता' },
  'nut.flow.bigDinner': { en: 'Full dinner', te: 'పూర్తి రాత్రి భోజనం', hi: 'भरपूर रात का खाना' },

  // ---- Quantities ----
  'nut.qty.oneMedium': { en: '1 medium', te: '1 మధ్యస్థ సైజు', hi: '1 मध्यम' },
  'nut.qty.ml200_250': { en: '200–250 ml', te: '200–250 మి.లీ.', hi: '200–250 मि.ली.' },
  'nut.qty.ml200': { en: '200 ml', te: '200 మి.లీ.', hi: '200 मि.ली.' },
  'nut.qty.g25_30': { en: '25–30 g', te: '25–30 గ్రా.', hi: '25–30 ग्राम' },
  'nut.qty.g20_30': { en: '20–30 g', te: '20–30 గ్రా.', hi: '20–30 ग्राम' },
  'nut.qty.g100_150': { en: '100–150 g', te: '100–150 గ్రా.', hi: '100–150 ग्राम' },
  'nut.qty.oneBowl': { en: '1 bowl', te: '1 గిన్నె', hi: '1 कटोरी' },
  'nut.qty.oneOrTwo': { en: '1–2', te: '1–2', hi: '1–2' },
  'nut.qty.oneServing': { en: '1 serving', te: '1 సర్వింగ్', hi: '1 सर्विंग' },
  'nut.qty.twoServings': { en: '1–2 servings', te: '1–2 సర్వింగ్‌లు', hi: '1–2 सर्विंग' },
  'nut.qty.handful': { en: 'A small handful', te: 'చిన్న గుప్పెడు', hi: 'एक छोटी मुट्ठी' },
  'nut.qty.individual': { en: 'A portion that suits you', te: 'మీకు తగిన మోతాదు', hi: 'आपके अनुसार मात्रा' },
  'nut.qty.byCalories': { en: 'Based on your calorie target', te: 'మీ క్యాలరీ లక్ష్యం ఆధారంగా', hi: 'आपके कैलोरी लक्ष्य के अनुसार' },

  // ---- When ----
  'nut.when.breakfast': { en: 'Breakfast', te: 'అల్పాహారం', hi: 'नाश्ते में' },
  'nut.when.breakfastEvening': { en: 'Breakfast or evening', te: 'అల్పాహారం లేదా సాయంత్రం', hi: 'नाश्ते में या शाम को' },
  'nut.when.breakfastLunch': { en: 'Breakfast or lunch', te: 'అల్పాహారం లేదా మధ్యాహ్న భోజనం', hi: 'नाश्ते या दोपहर के खाने में' },
  'nut.when.eveningSnack': { en: 'Evening snack', te: 'సాయంత్రం స్నాక్', hi: 'शाम का नाश्ता' },
  'nut.when.lunchDinner': { en: 'Lunch or dinner', te: 'మధ్యాహ్నం లేదా రాత్రి భోజనం', hi: 'दोपहर या रात के खाने में' },
  'nut.when.lunch': { en: 'Lunch', te: 'మధ్యాహ్న భోజనం', hi: 'दोपहर के खाने में' },
  'nut.when.lunchEvening': { en: 'Lunch or evening', te: 'మధ్యాహ్నం లేదా సాయంత్రం', hi: 'दोपहर या शाम को' },
  'nut.when.morningEvening': { en: 'Morning or evening', te: 'ఉదయం లేదా సాయంత్రం', hi: 'सुबह या शाम' },
  'nut.when.snack': { en: 'Snack time', te: 'స్నాక్ సమయంలో', hi: 'नाश्ते के समय' },
  'nut.when.midMorning': { en: '10–11 AM', te: 'ఉదయం 10–11', hi: 'सुबह 10–11' },
  'nut.when.evening4to6': { en: '4–6 PM', te: 'సాయంత్రం 4–6', hi: 'शाम 4–6' },
  'nut.when.dinner': { en: 'Dinner', te: 'రాత్రి భోజనం', hi: 'रात के खाने में' },
  'nut.when.meals': { en: 'With main meals', te: 'ప్రధాన భోజనాలతో', hi: 'मुख्य भोजन के साथ' },

  // ---- Frequency ----
  'nut.freq.daily': { en: 'Daily', te: 'ప్రతిరోజూ', hi: 'रोज़' },
  'nut.freq.dailyIfTolerated': { en: 'Daily, if it suits you', te: 'సరిపడితే ప్రతిరోజూ', hi: 'अगर सहन हो तो रोज़' },
  'nut.freq.dailyIfSuitable': { en: 'Daily, if suitable for you', te: 'మీకు సరిపోతే ప్రతిరోజూ', hi: 'अगर उपयुक्त हो तो रोज़' },
  'nut.freq.dailyOrOften': { en: 'Daily or several times a week', te: 'ప్రతిరోజూ లేదా వారానికి పలుసార్లు', hi: 'रोज़ या सप्ताह में कई बार' },
  'nut.freq.asAppropriate': { en: 'As appropriate for you', te: 'మీకు తగినట్టుగా', hi: 'आपके अनुसार' },
  'nut.freq.onceTwiceDaily': { en: '1–2 times a day', te: 'రోజుకు 1–2 సార్లు', hi: 'दिन में 1–2 बार' },
  'nut.freq.mostDays': { en: 'Most days', te: 'చాలా రోజులు', hi: 'ज़्यादातर दिन' },
  'nut.freq.severalWeek': { en: 'Several times a week', te: 'వారానికి పలుసార్లు', hi: 'सप्ताह में कई बार' },
  'nut.freq.individualNeeds': { en: 'According to your dietary needs', te: 'మీ ఆహార అవసరాల ప్రకారం', hi: 'आपकी आहार ज़रूरत के अनुसार' },

  // ---- Foods ----
  'nut.food.banana.name': { en: 'Banana', te: 'అరటిపండు', hi: 'केला' },
  'nut.food.banana.why': { en: 'Provides energy and carbohydrates.', te: 'శక్తి మరియు పిండిపదార్థాలను అందిస్తుంది.', hi: 'ऊर्जा और कार्बोहाइड्रेट देता है।' },
  'nut.food.banana.alt': { en: 'Papaya / seasonal fruit', te: 'బొప్పాయి / సీజన్ పండు', hi: 'पपीता / मौसमी फल' },

  'nut.food.milk.name': { en: 'Milk', te: 'పాలు', hi: 'दूध' },
  'nut.food.milk.why': { en: 'Provides protein and energy.', te: 'ప్రొటీన్ మరియు శక్తిని అందిస్తుంది.', hi: 'प्रोटीन और ऊर्जा देता है।' },
  'nut.food.milk.alt': { en: 'Curd / a fortified alternative', te: 'పెరుగు / తగిన ప్రత్యామ్నాయం', hi: 'दही / उपयुक्त विकल्प' },

  'nut.food.peanuts.name': { en: 'Peanuts', te: 'వేరుశనగ', hi: 'मूंगफली' },
  'nut.food.peanuts.why': { en: 'Provides energy, protein and healthy fats.', te: 'శక్తి, ప్రొటీన్ మరియు ఆరోగ్యకరమైన కొవ్వులను అందిస్తుంది.', hi: 'ऊर्जा, प्रोटीन और स्वस्थ वसा देती है।' },
  'nut.food.peanuts.alt': { en: 'Almonds / mixed nuts', te: 'బాదం / మిక్స్‌డ్ నట్స్', hi: 'बादाम / मिले-जुले मेवे' },

  'nut.food.dal.name': { en: 'Dal', te: 'పప్పు', hi: 'दाल' },
  'nut.food.dal.why': { en: 'Provides protein and fiber.', te: 'ప్రొటీన్ మరియు పీచును అందిస్తుంది.', hi: 'प्रोटीन और फाइबर देती है।' },
  'nut.food.dal.alt': { en: 'Chickpeas / rajma', te: 'శనగలు / రాజ్మా', hi: 'छोले / राजमा' },

  'nut.food.egg.name': { en: 'Egg', te: 'గుడ్డు', hi: 'अंडा' },
  'nut.food.egg.why': { en: 'High-quality protein.', te: 'అధిక నాణ్యత గల ప్రొటీన్.', hi: 'उच्च गुणवत्ता वाला प्रोटीन।' },
  'nut.food.egg.alt': { en: 'Paneer / tofu / dal', te: 'పనీర్ / టోఫు / పప్పు', hi: 'पनीर / टोफू / दाल' },

  'nut.food.curd.name': { en: 'Curd', te: 'పెరుగు', hi: 'दही' },
  'nut.food.curd.why': { en: 'Provides protein and other nutrients.', te: 'ప్రొటీన్ మరియు ఇతర పోషకాలను అందిస్తుంది.', hi: 'प्रोटीन और अन्य पोषक तत्व देता है।' },
  'nut.food.curd.alt': { en: 'Unsweetened buttermilk', te: 'తీపి కలపని మజ్జిగ', hi: 'बिना चीनी की छाछ' },

  'nut.food.rice.name': { en: 'Rice / roti', te: 'అన్నం / రొట్టె', hi: 'चावल / रोटी' },
  'nut.food.rice.why': { en: 'Your main source of energy and carbohydrate.', te: 'శక్తి మరియు పిండిపదార్థాల ప్రధాన వనరు.', hi: 'ऊर्जा और कार्बोहाइड्रेट का मुख्य स्रोत।' },
  'nut.food.rice.alt': { en: 'Millets', te: 'చిరుధాన్యాలు', hi: 'मोटे अनाज (मिलेट)' },

  'nut.food.vegetables.name': { en: 'Vegetables', te: 'కూరగాయలు', hi: 'सब्ज़ियाँ' },
  'nut.food.vegetables.why': { en: 'Provides fiber, vitamins and minerals.', te: 'పీచు, విటమిన్లు మరియు ఖనిజాలను అందిస్తాయి.', hi: 'फाइबर, विटामिन और खनिज देती हैं।' },
  'nut.food.vegetables.alt': { en: 'Whatever is in season', te: 'సీజన్‌లో దొరికే కూరగాయలు', hi: 'मौसमी सब्ज़ियाँ' },

  'nut.food.fruit.name': { en: 'Fruit', te: 'పండు', hi: 'फल' },
  'nut.food.fruit.why': { en: 'Provides fiber and micronutrients.', te: 'పీచు మరియు సూక్ష్మపోషకాలను అందిస్తుంది.', hi: 'फाइबर और सूक्ष्म पोषक तत्व देता है।' },
  'nut.food.fruit.alt': { en: 'Guava / papaya / orange', te: 'జామ / బొప్పాయి / నారింజ', hi: 'अमरूद / पपीता / संतरा' },

  'nut.food.nuts.name': { en: 'Nuts', te: 'నట్స్', hi: 'मेवे' },
  'nut.food.nuts.why': { en: 'Provides healthy fats and nutrients.', te: 'ఆరోగ్యకరమైన కొవ్వులు మరియు పోషకాలను అందిస్తాయి.', hi: 'स्वस्थ वसा और पोषक तत्व देते हैं।' },
  'nut.food.nuts.alt': { en: 'Seeds / peanuts', te: 'విత్తనాలు / వేరుశనగ', hi: 'बीज / मूंगफली' },

  'nut.food.cucumber.name': { en: 'Cucumber', te: 'దోసకాయ', hi: 'खीरा' },
  'nut.food.cucumber.why': { en: 'Fills the plate and hydrates, for very few calories.', te: 'చాలా తక్కువ క్యాలరీలతో కడుపు నిండిన అనుభూతిని, నీటిని అందిస్తుంది.', hi: 'बहुत कम कैलोरी में पेट भरने का एहसास और पानी देता है।' },
  'nut.food.cucumber.alt': { en: 'Tomato / other salad vegetables', te: 'టమాటా / ఇతర సలాడ్ కూరగాయలు', hi: 'टमाटर / अन्य सलाद सब्ज़ियाँ' },

  'nut.food.greens.name': { en: 'Green vegetables', te: 'ఆకుకూరలు, పచ్చి కూరగాయలు', hi: 'हरी सब्ज़ियाँ' },
  'nut.food.greens.why': { en: 'Provides fiber and micronutrients.', te: 'పీచు మరియు సూక్ష్మపోషకాలను అందిస్తాయి.', hi: 'फाइबर और सूक्ष्म पोषक तत्व देती हैं।' },
  'nut.food.greens.alt': { en: 'Cabbage / cauliflower / beans', te: 'క్యాబేజీ / కాలీఫ్లవర్ / బీన్స్', hi: 'पत्ता गोभी / फूलगोभी / बीन्स' },

  'nut.food.wholeFruit.name': { en: 'Whole fruit', te: 'మొత్తం పండు', hi: 'साबुत फल' },
  'nut.food.wholeFruit.why': { en: 'A better source of fiber than sweets or juice.', te: 'స్వీట్లు లేదా జ్యూస్ కంటే మెరుగైన పీచు వనరు.', hi: 'मिठाई या जूस से बेहतर फाइबर स्रोत।' },
  'nut.food.wholeFruit.alt': { en: 'Guava / orange / papaya', te: 'జామ / నారింజ / బొప్పాయి', hi: 'अमरूद / संतरा / पपीता' },

  'nut.food.chana.name': { en: 'Roasted chana', te: 'వేయించిన శనగలు', hi: 'भुना चना' },
  'nut.food.chana.why': { en: 'Provides protein and fiber.', te: 'ప్రొటీన్ మరియు పీచును అందిస్తుంది.', hi: 'प्रोटीन और फाइबर देता है।' },
  'nut.food.chana.alt': { en: 'Peanuts, in a sensible portion', te: 'తగిన మోతాదులో వేరుశనగ', hi: 'उचित मात्रा में मूंगफली' },

  'nut.food.oats.name': { en: 'Oats', te: 'ఓట్స్', hi: 'ओट्स' },
  'nut.food.oats.why': { en: 'Provides carbohydrate and fiber.', te: 'పిండిపదార్థాలు మరియు పీచును అందిస్తుంది.', hi: 'कार्बोहाइड्रेट और फाइबर देता है।' },
  'nut.food.oats.alt': { en: 'Poha / upma', te: 'అటుకులు / ఉప్మా', hi: 'पोहा / उपमा' },

  'nut.food.fish.name': { en: 'Fish / chicken', te: 'చేప / చికెన్', hi: 'मछली / चिकन' },
  'nut.food.fish.why': { en: 'A lean protein source.', te: 'తక్కువ కొవ్వు గల ప్రొటీన్ వనరు.', hi: 'कम वसा वाला प्रोटीन स्रोत।' },
  'nut.food.fish.alt': { en: 'Paneer / tofu / dal', te: 'పనీర్ / టోఫు / పప్పు', hi: 'पनीर / टोफू / दाल' },

  'nut.food.protein.name': { en: 'A protein source', te: 'ఒక ప్రొటీన్ వనరు', hi: 'एक प्रोटीन स्रोत' },
  'nut.food.protein.why': { en: 'Supports your daily protein intake.', te: 'రోజువారీ ప్రొటీన్ అవసరాన్ని తీరుస్తుంది.', hi: 'दैनिक प्रोटीन ज़रूरत पूरी करता है।' },
  'nut.food.protein.alt': { en: 'Egg / paneer / tofu / dal', te: 'గుడ్డు / పనీర్ / టోఫు / పప్పు', hi: 'अंडा / पनीर / टोफू / दाल' },

  'nut.food.sweetPotato.name': { en: 'Sweet potato', te: 'చిలగడదుంప', hi: 'शकरकंद' },
  'nut.food.sweetPotato.why': { en: 'Nutrient-dense energy.', te: 'పోషకాలతో కూడిన శక్తి.', hi: 'पोषक तत्वों से भरपूर ऊर्जा।' },
  'nut.food.sweetPotato.alt': { en: 'Banana', te: 'అరటిపండు', hi: 'केला' },

  // ---- Reduce ----
  'nut.reduce.softDrinks.name': { en: 'Sugary drinks', te: 'చక్కెర పానీయాలు', hi: 'मीठे पेय' },
  'nut.reduce.softDrinks.why': {
    en: 'They add a lot of calories without making you feel full.',
    te: 'కడుపు నిండిన అనుభూతి ఇవ్వకుండా చాలా క్యాలరీలను జోడిస్తాయి.',
    hi: 'पेट भरे बिना काफ़ी कैलोरी बढ़ा देते हैं।',
  },
  'nut.reduce.sweets.name': { en: 'Excess sweets', te: 'మితిమీరిన స్వీట్లు', hi: 'ज़्यादा मिठाइयाँ' },
  'nut.reduce.fried.name': { en: 'Deep-fried food', te: 'డీప్ ఫ్రై చేసిన ఆహారం', hi: 'तली हुई चीज़ें' },
  'nut.reduce.fastFood.name': { en: 'Fast food', te: 'ఫాస్ట్ ఫుడ్', hi: 'फास्ट फूड' },
  'nut.reduce.processed.name': { en: 'Highly processed snacks', te: 'అధికంగా ప్రాసెస్ చేసిన స్నాక్స్', hi: 'अत्यधिक प्रोसेस्ड स्नैक्स' },
  'nut.reduce.bigPortions.name': { en: 'Oversized portions', te: 'అవసరానికి మించిన పరిమాణాలు', hi: 'ज़रूरत से बड़ी मात्रा' },
  'nut.reduce.alcohol.name': { en: 'Excess alcohol, where it applies', te: 'వర్తించే చోట మితిమీరిన మద్యం', hi: 'जहाँ लागू हो, अत्यधिक शराब' },
}
