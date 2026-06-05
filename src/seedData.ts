import { Question } from "./types";

export const INITIAL_QUESTIONS: Question[] = [
  {
    id: "seed-1",
    subject: "الرياضيات",
    difficulty: "سهل",
    question_text: "ما هي قيمة س في المعادلة الجبرية التالية: 2س + 4 = 12 ؟",
    options: ["س = 2", "س = 4", "س = 6", "س = 8"],
    correct_answer: "ب",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString()
  },
  {
    id: "seed-2",
    subject: "الرياضيات",
    difficulty: "متوسط",
    question_text: "المثلث الذي أطوال أضلاعه تشكل الأعداد 3سم، 4سم، 5سم يعتبر مثلثاً:",
    options: ["حاد الزوايا", "قائم الزاوية", "منفرج الزاوية", "متساوي الساقين والمستقيم الأضلاع"],
    correct_answer: "ب",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4).toISOString()
  },
  {
    id: "seed-3",
    subject: "الرياضيات",
    difficulty: "صعب",
    question_text: "إذا كانت د(س) = س^2 - 3س + 2، فما هي قيمة المشتقة الأولى د'(3)؟",
    options: ["قيمة المشتقة د'(3) تساوي 1", "قيمة المشتقة د'(3) تساوي 3", "قيمة المشتقة د'(3) تساوي 5", "قيمة المشتقة د'(3) تساوي 9"],
    correct_answer: "ب",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString()
  },
  {
    id: "seed-4",
    subject: "الفيزياء",
    difficulty: "متوسط",
    question_text: "احسب مقدار القوة الكلية اللازمة لتحريك جسم كتلته 10 كجم بعجلة منتظمة مقدارها 5 م/ث²؟",
    options: ["القوة المطلوبة هي 20 نيوتن", "القوة المطلوبة هي 50 نيوتن", "القوة المطلوبة هي 15 نيوتن", "القوة المطلوبة هي 100 نيوتن"],
    correct_answer: "ب",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString()
  },
  {
    id: "seed-5",
    subject: "الفيزياء",
    difficulty: "سهل",
    question_text: "أي من الخيارات التالية يعتبر الناقل الأفضل للتيار الكهربائي والحراري في الظروف الطبيعية؟",
    options: ["سلك النحاس النقي", "لوح الخشب الجاف", "شريحة من الزجاج المصقول", "قطعة من البلاستيك المقوى"],
    correct_answer: "أ",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString()
  },
  {
    id: "seed-6",
    subject: "الكيمياء",
    difficulty: "سهل",
    question_text: "ما هي الصيغة الكيميائية الصحيحة المعبرة عن جزيء الماء النقي؟",
    options: ["CO2 (ثاني أكسيد الكربون)", "H2O (أكسيد الثنائي للهيدروجين)", "O2 (غاز الأكسجين الثنائي)", "NaCl (كلوريد الصوديوم)"],
    correct_answer: "ب",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString()
  },
  {
    id: "seed-7",
    subject: "الكيمياء",
    difficulty: "صعب",
    question_text: "الرابطة الكيمائية التي تتكون نتيجة المساهمة المشتركة بزوج أو أكثر من الإلكترونات بين ذرتين تسمى:",
    options: ["رابطة أيونية قوية", "رابطة تساهمية (شاركية)", "رابطة فلزية بلورية", "رابطة هيدروجينية ضعيفة"],
    correct_answer: "ب",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString()
  },
  {
    id: "seed-8",
    subject: "الأحياء",
    difficulty: "متوسط",
    question_text: "كم عدد الكروموسومات الإجمالي الموجود في نواة الخلية الجسدية للإنسان السليم والمعافى طبيعياً؟",
    options: ["23 كروموسوم مفرد", "46 كروموسوم (23 زوج)", "48 كروموسوم متصل", "92 كروموسوم متضاعف"],
    correct_answer: "ب",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString()
  },
  {
    id: "seed-9",
    subject: "الأحياء",
    difficulty: "سهل",
    question_text: "ما هو العضو العضلي الرئيسي المباشر المسؤول عن ضخ الدم إلى الرئتين وكافة خلايا جسم الإنسان؟",
    options: ["القلب النابض", "الرئتان للتنفس", "الكبد لتصفية السموم", "البنكرياس لإفراز الإنسولين"],
    correct_answer: "أ",
    created_at: new Date().toISOString()
  },
  {
    id: "seed-10",
    subject: "العلوم العامة",
    difficulty: "سهل",
    question_text: "الوحدة الفيزيائية الدولية الأساسية المخصصة لقياس شدة التيار الكهربائي المار في دائرة مغلقة هي:",
    options: ["الفولت (Volt)", "الأمبير (Ampere)", "الأوم (Ohm)", "الوات (Watt)"],
    correct_answer: "ب",
    created_at: new Date().toISOString()
  },
  {
    id: "seed-11",
    subject: "العلوم العامة",
    difficulty: "سهل",
    question_text: "ما هو الكوكب الأقرب من الناحية المسافية المباشرة إلى مركز الشمس في مجموعتنا الشمسية؟",
    options: ["كوكب المريخ الأحمر", "كوكب الزهرة اللامع", "كوكب عطارد السريع", "كوكب المشتري العملاق"],
    correct_answer: "ج",
    created_at: new Date().toISOString()
  }
];
