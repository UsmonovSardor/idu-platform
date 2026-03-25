// ══════════════════════════════════════════════════════════════════
//  v18 — API CLIENT + SECURITY LAYER
// ══════════════════════════════════════════════════════════════════

// Backend base URL — change to your deployed server URL in production
var API_BASE = 'https://idu-platform.onrender.com/api';

// JWT token storage (memory-first, localStorage fallback for "remember me")
var _apiToken = null;

/**
 * safeHTML(str) — Always sanitize before any innerHTML assignment.
 * DOMPurify strips XSS payloads automatically.
 * Falls back to plain text if DOMPurify is not loaded (should not happen).
 */
function safeHTML(str) {
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(String(str || ''), {
      ALLOWED_TAGS: ['b','i','em','strong','span','div','p','br','ul','ol','li',
                     'table','thead','tbody','tr','th','td','h2','h3','h4','small',
                     'button','svg','path','circle','rect','input','label','textarea',
                     'select','option','form'],
      ALLOWED_ATTR: ['class','id','style','type','value','placeholder','onclick',
                     'data-*','href','src','alt','name','checked','disabled','selected',
                     'rowspan','colspan','for','aria-label','title'],
    });
  }
  // Fallback: escape HTML
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/**
 * api(method, path, body) — Wrapper for all backend API calls.
 * Returns parsed JSON on success, throws Error on failure.
 * Falls back silently to offline mode if server unreachable.
 */
async function api(method, path, body) {
  var headers = { 'Content-Type': 'application/json' };
  if (_apiToken) headers['Authorization'] = 'Bearer ' + _apiToken;
  try {
    var res = await fetch(API_BASE + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    var data = await res.json().catch(function() { return {}; });
    if (!res.ok) {
      throw Object.assign(new Error(data.error || ('HTTP ' + res.status)), { status: res.status, data: data });
    }
    return data;
  } catch (err) {
    // Network error → re-throw so callers can handle or fall back
    throw err;
  }
}

/**
 * apiLogin(role, email, password) — Call backend auth, store JWT.
 * Returns { ok: true, user } on success, { ok: false, error } on failure.
 * Falls back to local USERS array if server is unreachable (demo/offline mode).
 */
async function apiLogin(role, email, password, remember) {
  try {
    var result = await api('POST', '/auth/login', { email: email, password: password });
    _apiToken = result.token;
    if (remember) {
      try { localStorage.setItem('idu_jwt', result.token); } catch(e) {}
    }
    return { ok: true, user: result.user };
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      return { ok: false, error: err.message };
    }
    // Server unreachable — fall back to local demo mode
    console.warn('[IDU] Backend unreachable, using demo mode:', err.message);
    return { ok: false, error: null, offline: true };
  }
}

/**
 * apiSubmitApplication(data) — POST to backend; falls back to localStorage.
 */
async function apiSubmitApplication(data) {
  if (!_apiToken) return false;
  try {
    await api('POST', '/applications', data);
    return true;
  } catch(e) {
    return false; // silently fall back to localStorage version
  }
}

/**
 * apiSubmitExam(attemptId, answers) — Submit exam to backend.
 */
async function apiSubmitExam(attemptId, answers) {
  if (!_apiToken || !attemptId) return null;
  try {
    return await api('POST', '/exams/' + attemptId + '/submit', { answers: answers });
  } catch(e) {
    return null;
  }
}

// Load saved JWT on page load
(function() {
  try {
    var saved = localStorage.getItem('idu_jwt');
    if (saved) _apiToken = saved;
  } catch(e) {}
})();

// ════════════════════════════════════
//  DATA
// ════════════════════════════════════
// ════════════════════════════════════
//  XAVFSIZLIK: Rol tokenları (cross-role kirish taqiqlash)
// ════════════════════════════════════
const ROLE_TOKENS = {
  student: 'STU_7x9Kq2mP',
  teacher: 'TCH_4mNp8wRz',
  dekanat: 'DEK_9zRt3vYk',
  investor: 'INV_2bLs6jQx'
};
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(36);
}

const USERS = {
  student: [
    {login:'alisher',pass:'1234',name:'Alisher Azimov',group:'AI-2301',course:2,gpa:3.7,avg:82.4,att:94,phone:'998901234567'},
    {login:'nilufar',pass:'2025',name:'Nilufar Karimova',group:'CS-2301',course:2,gpa:3.5,avg:79.1,att:98,phone:'998907654321'},
    {login:'jasur',pass:'pass1',name:'Jasur Toshpulatov',group:'IT-2301',course:3,gpa:3.2,avg:74.3,att:88,phone:'998931112233'},
  ],
  teacher: [
    {login:'karimov',pass:'admin',name:'Karimov Alisher',dept:'Matematika',subjects:['Matematika','Algebra'],phone:'998901234599'},
    {login:'toshmatov',pass:'teach1',name:'Toshmatov Bobur',dept:'Kompyuter Fanlari',subjects:['Dasturlash','Algoritmlar'],phone:'998909988776'},
    {login:'rahimova',pass:'teach2',name:'Rahimova Nodira',dept:'Ingliz tili',subjects:['Ingliz tili','Ingliz aloqasi'],phone:'998935544332'},
  ],
  dekanat: [{login:'dekanat',pass:'admin123',name:'Dekanat Admin',role:'Dekan yordamchisi',phone:'998712345678'}],
  investor: [{login:'invest1',pass:'inv123',name:'Bekzod Yusupov',company:'TechVentures UZ',phone:'998901122334'}],
};
// localStorage da saqlangan yangi foydalanuvchilarni yuklab olish
function loadExtraUsers() {
  try {
    const extra = JSON.parse(_lsGet('idu_extra_users') || '{}');
    Object.keys(extra).forEach(role => {
      if (USERS[role]) USERS[role].push(...extra[role]);
    });
  } catch(e){}
}
loadExtraUsers();

const DAYS_UZ_WEEK = ['Dushanba','Seshanba','Chorshanba','Payshanba','Juma'];
const DAYS_RU_WEEK = ['Понедельник','Вторник','Среда','Четверг','Пятница'];
const DAYS_SHORT_UZ = ['Du','Se','Ch','Pa','Ju'];
const DAYS_SHORT_RU = ['Пн','Вт','Ср','Чт','Пт'];
function _daysWeek(){ return currentLang==='ru'?DAYS_RU_WEEK:DAYS_UZ_WEEK; }
function _daysShort(){ return currentLang==='ru'?DAYS_SHORT_RU:DAYS_SHORT_UZ; }
const TYPE_RU={"Ma'ruza":'Лекция','Laboratoriya':'Лаборатория','Amaliyot':'Практика','Seminar':'Семинар'};
function _type(t){ return currentLang==='ru'?(TYPE_RU[t]||t):t; }
// Keep backward compat
const DAYS = DAYS_UZ_WEEK;
const DAYS_SHORT = DAYS_SHORT_UZ;
const TIMES = [
  '08:30–10:00','10:15–11:45','12:30–14:00','14:15–15:45','16:00–17:30'
];

const SUBJECTS_COLORS = {
  // AI yo'nalishi
  'Machine Learning':'tt-purple','Python for AI':'tt-blue','Deep Learning':'tt-purple',
  'Matematika (AI uchun)':'tt-blue','Data Science':'tt-teal','Computer Vision':'tt-green',
  'Neural Networks':'tt-purple','Natural Language Processing':'tt-teal',
  // Cybersecurity yo'nalishi
  'Network Security':'tt-red','Ethical Hacking':'tt-red','Web Application Security':'tt-orange',
  'Kriptografiya':'tt-teal','Digital Forensics':'tt-orange','Cloud Security':'tt-blue',
  'IDS/IPS Tizimlari':'tt-red','Incident Response':'tt-orange',
  // Computing & IT yo'nalishi
  'Dasturlash Asoslari':'tt-purple',"Ma'lumotlar Tuzilmasi":'tt-blue','Algoritmlar':'tt-red',
  'Web Dasturlash':'tt-green',"Ma'lumotlar Bazasi":'tt-teal',
  'Kompyuter Tarmoqlari':'tt-blue','Operatsion Tizimlar':'tt-orange',
  'Software Engineering':'tt-purple','Cloud Computing':'tt-teal',
  // Digital Business yo'nalishi
  'Raqamli Marketing':'tt-orange','E-Tijorat':'tt-green','Biznes Analitika':'tt-blue',
  'Raqamli Transformatsiya':'tt-purple','Loyiha Boshqaruvi':'tt-teal',
  'Moliyaviy Texnologiyalar':'tt-orange','Tadbirkorlik':'tt-green',
  // Umumiy fanlar
  'Ingliz tili (Tech)':'tt-orange','Ingliz tili':'tt-orange',
  'Matematika':'tt-blue','Fizika':'tt-green','Algoritmlar va Dasturlash':'tt-red'
};

// Schedule data (EduPage style)
const SCHEDULE = {
  'AI-2301': [
    [
      {sub:'Machine Learning',teacher:'Prof. Rahimov J.',room:'Lab-AI',type:"Ma'ruza"},
      null,
      {sub:'Python for AI',teacher:'Prof. Rahimov J.',room:'Lab-AI',type:'Laboratoriya'},
      {sub:"Matematika (AI uchun)",teacher:'Prof. Yusupova M.',room:'A-201',type:'Seminar'},
      {sub:'Ingliz tili (Tech)',teacher:'Prof. Rahimova N.',room:'A-102',type:"Amaliyot"}
    ],
    [
      {sub:'Deep Learning',teacher:'Prof. Ergashev T.',room:'Lab-AI',type:"Ma'ruza"},
      {sub:'Data Science',teacher:'Prof. Yusupova M.',room:'A-201',type:"Ma'ruza"},
      null,
      {sub:'Machine Learning',teacher:'Prof. Rahimov J.',room:'Lab-AI',type:'Laboratoriya'},
      {sub:"Matematika (AI uchun)",teacher:'Prof. Yusupova M.',room:'A-201',type:"Ma'ruza"}
    ],
    [
      null,
      {sub:'Python for AI',teacher:'Prof. Rahimov J.',room:'Lab-AI',type:'Laboratoriya'},
      {sub:'Computer Vision',teacher:'Prof. Ergashev T.',room:'Lab-AI',type:"Ma'ruza"},
      {sub:'Ingliz tili (Tech)',teacher:'Prof. Rahimova N.',room:'A-102',type:"Amaliyot"},
      null
    ],
    [
      {sub:'Neural Networks',teacher:'Prof. Rahimov J.',room:'Lab-AI',type:"Ma'ruza"},
      null,
      {sub:'Data Science',teacher:'Prof. Yusupova M.',room:'A-201',type:'Laboratoriya'},
      {sub:'Deep Learning',teacher:'Prof. Ergashev T.',room:'Lab-AI',type:'Seminar'},
      {sub:'Computer Vision',teacher:'Prof. Ergashev T.',room:'Lab-AI',type:'Laboratoriya'}
    ],
    [
      {sub:"Matematika (AI uchun)",teacher:'Prof. Yusupova M.',room:'A-201',type:"Ma'ruza"},
      {sub:'Neural Networks',teacher:'Prof. Rahimov J.',room:'Lab-AI',type:'Amaliyot'},
      null,
      {sub:'Machine Learning',teacher:'Prof. Rahimov J.',room:'Lab-AI',type:'Seminar'},
      null
    ]
  ],
  'CS-2301': [
    [
      {sub:'Network Security',teacher:'Prof. Toshmatov A.',room:'Lab-CS',type:"Ma'ruza"},
      null,
      {sub:'Ethical Hacking',teacher:'Prof. Toshmatov A.',room:'Lab-CS',type:'Laboratoriya'},
      {sub:'Kriptografiya',teacher:'Prof. Nazarov B.',room:'A-301',type:"Ma'ruza"},
      {sub:'Ingliz tili (Tech)',teacher:'Prof. Rahimova N.',room:'A-102',type:"Amaliyot"}
    ],
    [
      {sub:'Web Application Security',teacher:'Prof. Toshmatov A.',room:'Lab-CS',type:"Ma'ruza"},
      {sub:'Digital Forensics',teacher:'Prof. Nazarov B.',room:'Lab-CS',type:"Ma'ruza"},
      null,
      {sub:'Network Security',teacher:'Prof. Toshmatov A.',room:'Lab-CS',type:'Laboratoriya'},
      {sub:'Kriptografiya',teacher:'Prof. Nazarov B.',room:'A-301',type:"Ma'ruza"}
    ],
    [
      null,
      {sub:'Ethical Hacking',teacher:'Prof. Toshmatov A.',room:'Lab-CS',type:'Amaliyot'},
      {sub:'Cloud Security',teacher:'Prof. Nazarov B.',room:'A-301',type:"Ma'ruza"},
      {sub:'Ingliz tili (Tech)',teacher:'Prof. Rahimova N.',room:'A-102',type:"Amaliyot"},
      null
    ],
    [
      {sub:'IDS/IPS Tizimlari',teacher:'Prof. Toshmatov A.',room:'Lab-CS',type:"Ma'ruza"},
      null,
      {sub:'Digital Forensics',teacher:'Prof. Nazarov B.',room:'Lab-CS',type:'Laboratoriya'},
      {sub:'Web Application Security',teacher:'Prof. Toshmatov A.',room:'Lab-CS',type:'Seminar'},
      {sub:'Cloud Security',teacher:'Prof. Nazarov B.',room:'A-301',type:'Laboratoriya'}
    ],
    [
      {sub:'Kriptografiya',teacher:'Prof. Nazarov B.',room:'A-301',type:"Ma'ruza"},
      {sub:'IDS/IPS Tizimlari',teacher:'Prof. Toshmatov A.',room:'Lab-CS',type:'Amaliyot'},
      null,
      {sub:'Network Security',teacher:'Prof. Toshmatov A.',room:'Lab-CS',type:'Seminar'},
      null
    ]
  ],
  'IT-2301': [
    [
      {sub:'Dasturlash Asoslari',teacher:'Prof. Rahimov Sh.',room:'Lab-IT',type:"Ma'ruza"},
      null,
      {sub:"Ma'lumotlar Tuzilmasi",teacher:'Prof. Rahimov Sh.',room:'Lab-IT',type:'Laboratoriya'},
      {sub:'Algoritmlar',teacher:'Prof. Rahimov Sh.',room:'A-202',type:"Ma'ruza"},
      {sub:'Ingliz tili (Tech)',teacher:'Prof. Rahimova N.',room:'A-102',type:"Amaliyot"}
    ],
    [
      {sub:'Web Dasturlash',teacher:'Prof. Ergashev T.',room:'Lab-IT',type:"Ma'ruza"},
      {sub:"Ma'lumotlar Bazasi",teacher:'Prof. Yusupova M.',room:'A-201',type:"Ma'ruza"},
      null,
      {sub:'Dasturlash Asoslari',teacher:'Prof. Rahimov Sh.',room:'Lab-IT',type:'Laboratoriya'},
      {sub:'Algoritmlar',teacher:'Prof. Rahimov Sh.',room:'A-202',type:"Ma'ruza"}
    ],
    [
      null,
      {sub:"Ma'lumotlar Tuzilmasi",teacher:'Prof. Rahimov Sh.',room:'Lab-IT',type:'Amaliyot'},
      {sub:'Kompyuter Tarmoqlari',teacher:'Prof. Ergashev T.',room:'A-202',type:"Ma'ruza"},
      {sub:'Ingliz tili (Tech)',teacher:'Prof. Rahimova N.',room:'A-102',type:"Amaliyot"},
      null
    ],
    [
      {sub:'Operatsion Tizimlar',teacher:'Prof. Ergashev T.',room:'Lab-IT',type:"Ma'ruza"},
      null,
      {sub:"Ma'lumotlar Bazasi",teacher:'Prof. Yusupova M.',room:'A-201',type:'Laboratoriya'},
      {sub:'Web Dasturlash',teacher:'Prof. Ergashev T.',room:'Lab-IT',type:'Seminar'},
      {sub:'Kompyuter Tarmoqlari',teacher:'Prof. Ergashev T.',room:'A-202',type:'Laboratoriya'}
    ],
    [
      {sub:'Algoritmlar',teacher:'Prof. Rahimov Sh.',room:'A-202',type:"Ma'ruza"},
      {sub:'Operatsion Tizimlar',teacher:'Prof. Ergashev T.',room:'Lab-IT',type:'Amaliyot'},
      null,
      {sub:"Ma'lumotlar Tuzilmasi",teacher:'Prof. Rahimov Sh.',room:'Lab-IT',type:'Seminar'},
      null
    ]
  ],
  'DB-2301': [
    [
      {sub:'Raqamli Marketing',teacher:'Prof. Nazarov B.',room:'A-301',type:"Ma'ruza"},
      null,
      {sub:'E-Tijorat',teacher:'Prof. Nazarov B.',room:'A-301',type:'Amaliyot'},
      {sub:'Biznes Analitika',teacher:'Prof. Yusupova M.',room:'A-201',type:"Ma'ruza"},
      {sub:'Ingliz tili (Tech)',teacher:'Prof. Rahimova N.',room:'A-102',type:"Amaliyot"}
    ],
    [
      {sub:'Raqamli Transformatsiya',teacher:'Prof. Nazarov B.',room:'A-301',type:"Ma'ruza"},
      {sub:'Loyiha Boshqaruvi',teacher:'Prof. Ergashev T.',room:'A-202',type:"Ma'ruza"},
      null,
      {sub:'Raqamli Marketing',teacher:'Prof. Nazarov B.',room:'A-301',type:'Amaliyot'},
      {sub:'Biznes Analitika',teacher:'Prof. Yusupova M.',room:'A-201',type:"Ma'ruza"}
    ],
    [
      null,
      {sub:'E-Tijorat',teacher:'Prof. Nazarov B.',room:'A-301',type:"Ma'ruza"},
      {sub:'Moliyaviy Texnologiyalar',teacher:'Prof. Yusupova M.',room:'A-201',type:"Ma'ruza"},
      {sub:'Ingliz tili (Tech)',teacher:'Prof. Rahimova N.',room:'A-102',type:"Amaliyot"},
      null
    ],
    [
      {sub:'Tadbirkorlik',teacher:'Prof. Nazarov B.',room:'A-301',type:"Ma'ruza"},
      null,
      {sub:'Loyiha Boshqaruvi',teacher:'Prof. Ergashev T.',room:'A-202',type:'Seminar'},
      {sub:'Raqamli Transformatsiya',teacher:'Prof. Nazarov B.',room:'A-301',type:'Amaliyot'},
      {sub:'Moliyaviy Texnologiyalar',teacher:'Prof. Yusupova M.',room:'A-201',type:'Laboratoriya'}
    ],
    [
      {sub:'Biznes Analitika',teacher:'Prof. Yusupova M.',room:'A-201',type:"Ma'ruza"},
      {sub:'Tadbirkorlik',teacher:'Prof. Nazarov B.',room:'A-301',type:'Amaliyot'},
      null,
      {sub:'E-Tijorat',teacher:'Prof. Nazarov B.',room:'A-301',type:'Seminar'},
      null
    ]
  ]
};
const GRADES_DATA = [
  {sub:'Machine Learning',teacher:'Prof. Rahimov J.',jn:27,on:18,yn:26,mi:19},
  {sub:'Python for AI',teacher:'Prof. Rahimov J.',jn:29,on:19,yn:28,mi:19},
  {sub:'Deep Learning',teacher:'Prof. Ergashev T.',jn:25,on:17,yn:24,mi:17},
  {sub:'Matematika (AI uchun)',teacher:'Prof. Yusupova M.',jn:24,on:16,yn:22,mi:16},
  {sub:'Data Science',teacher:'Prof. Yusupova M.',jn:26,on:18,yn:25,mi:18},
  {sub:'Ingliz tili (Tech)',teacher:'Prof. Rahimova N.',jn:22,on:15,yn:21,mi:15},
  {sub:'Natural Language Processing',teacher:'Prof. Rahimov J.',jn:24,on:16,yn:23,mi:17},
  {sub:'Computer Vision',teacher:'Prof. Ergashev T.',jn:23,on:16,yn:22,mi:16},
];

const STUDENTS_DATA = [
  {id:1,name:'Azimov Alisher',group:'AI-2301',course:1,avg:87,att:96,gpa:3.9},
  {id:2,name:'Karimova Nilufar',group:'AI-2301',course:1,avg:82,att:98,gpa:3.7},
  {id:3,name:'Toshev Jasur',group:'AI-2301',course:1,avg:74,att:89,gpa:3.3},
  {id:4,name:'Mirzayeva Dilnoza',group:'AI-2301',course:1,avg:91,att:100,gpa:4.0},
  {id:5,name:'Umarov Sardor',group:'CS-2301',course:1,avg:79,att:93,gpa:3.5},
  {id:6,name:'Hasanova Mohira',group:'CS-2301',course:1,avg:85,att:97,gpa:3.8},
  {id:7,name:'Raimov Sherzod',group:'CS-2301',course:1,avg:68,att:81,gpa:3.0},
  {id:8,name:'Nazarova Zulfiya',group:'CS-2301',course:1,avg:76,att:92,gpa:3.4},
  {id:9,name:'Tursunov Bobur',group:'IT-2301',course:1,avg:72,att:85,gpa:3.2},
  {id:10,name:'Sobirov Farrux',group:'IT-2301',course:1,avg:80,att:94,gpa:3.6},
  {id:11,name:'Eshmatov Ulugbek',group:'DB-2301',course:1,avg:78,att:91,gpa:3.5},
  {id:12,name:'Toshpulatova Kamola',group:'DB-2301',course:1,avg:84,att:96,gpa:3.7},
  {id:13,name:'Mirzaev Otabek',group:'AI-2301',course:1,avg:65,att:78,gpa:2.9},
  {id:14,name:'Yusupova Feruza',group:'CS-2301',course:1,avg:88,att:99,gpa:3.9},
  {id:15,name:'Normatov Behruz',group:'IT-2301',course:1,avg:77,att:90,gpa:3.4},
  {id:16,name:'Qodirov Mansur',group:'DB-2301',course:1,avg:83,att:95,gpa:3.7},
];

const TEACHERS_DATA = [
  {id:1,name:"Prof. Rahimov Jasur",dept:"Sun'iy Intellekt",subjects:['Machine Learning','Deep Learning','Neural Networks','Python for AI'],groups:['AI-2301'],hours:24,rating:4.9},
  {id:2,name:'Prof. Toshmatov Alisher',dept:'Kiberxavfsizlik',subjects:['Network Security','Ethical Hacking','Web Application Security','IDS/IPS Tizimlari'],groups:['CS-2301'],hours:22,rating:4.8},
  {id:3,name:'Prof. Yusupova Malika',dept:"Matematika & Data Science",subjects:["Matematika (AI uchun)",'Data Science','Biznes Analitika','Moliyaviy Texnologiyalar'],groups:['AI-2301','DB-2301'],hours:20,rating:4.7},
  {id:4,name:'Prof. Rahimova Nodira',dept:'Ingliz tili',subjects:['Ingliz tili (Tech)'],groups:['AI-2301','CS-2301','IT-2301','DB-2301'],hours:16,rating:4.6},
  {id:5,name:'Prof. Nazarov Bobur',dept:'Digital Business',subjects:['Raqamli Marketing','E-Tijorat','Raqamli Transformatsiya','Tadbirkorlik','Kriptografiya','Digital Forensics','Cloud Security'],groups:['DB-2301','CS-2301'],hours:20,rating:4.8},
  {id:6,name:'Prof. Ergashev Timur',dept:'Computing & Networks',subjects:['Computer Vision','Kompyuter Tarmoqlari','Web Dasturlash','Operatsion Tizimlar','Loyiha Boshqaruvi'],groups:['AI-2301','IT-2301','DB-2301'],hours:22,rating:4.7},
  {id:7,name:'Prof. Rahimov Sherzod',dept:'Computing/IT',subjects:["Dasturlash Asoslari","Ma'lumotlar Tuzilmasi","Algoritmlar"],groups:['IT-2301'],hours:18,rating:4.8},
];

const TASKS_DATA = [
  {id:1,sub:'Machine Learning',name:'Linear Regression modeli yaratish',type:'project',due:'2026-03-10',pts:25},
  {id:2,sub:'Python for AI',name:'NumPy va Pandas bilan ishlash',type:'lab',due:'2026-03-07',pts:20},
  {id:3,sub:'Deep Learning',name:'CNN arxitekturasi testi',type:'test',due:'2026-03-12',pts:15},
  {id:4,sub:'Ingliz tili (Tech)',name:'Tech essay: AI in Uzbekistan (400 words)',type:'hw',due:'2026-03-08',pts:10},
  {id:5,sub:'Data Science',name:'EDA: real dataset tahlili',type:'project',due:'2026-03-14',pts:30},
  {id:6,sub:'Matematika (AI uchun)',name:'Chiziqli algebra testi',type:'test',due:'2026-03-11',pts:15},
];

const NOTIFS = [
  {icon:'📊',color:'var(--primary-light)',title:'Yangi baho kiritildi',text:'Machine Learning fanidan ON bahosi: 18/20 — Prof. Rahimov J.',time:'10 daqiqa oldin',unread:true},
  {icon:'📅',color:'var(--orange-light)',title:'Dars o\'zgardi',text:"Ertangi Deep Learning darsi Lab-AI dan A-201 xonaga ko\'chirildi",time:'1 soat oldin',unread:true},
  {icon:'⚠️',color:'var(--red-light)',title:'Davomat ogohlantirishi',text:'Python for AI darsiga 2 marta kelmadingiz — diqqat!',time:'Kecha',unread:true},
  {icon:'🎉',color:'var(--green-light)',title:'Reyting yangilandi',text:'AI-2301 guruhi reytingida #3 o\'ringa ko\'tarildingiz! 🏆',time:'2 kun oldin',unread:false},
  {icon:'📝',color:'var(--purple-light)',title:'Yangi vazifa',text:'Data Science: EDA loyihasi — muddati 14-mart',time:'3 kun oldin',unread:false},
  {icon:'🏫',color:'var(--purple-light)',title:"IDU xabarnomasi",text:"Wolverhampton universiteti bilan hamkorlik dasturi boshlandi — ariza qabul qilinmoqda",time:'4 kun oldin',unread:false},
];

let IDEAS = [
  {
    id:1,title:'EduBot — AI O\'qituvchi',category:'edu',
    desc:'Sun\'iy intellekt asosida ishlaydi va har bir talabaga shaxsiy o\'quv rejasi tuzib beradi. Zaif tomonlarini aniqlaydi va maxsus mashqlar taklif qiladi.',
    team:['Alisher Azimov','Nilufar Karimova','Sardor Umarov'],
    investment:'30,000$',likes:24,stars:4,comments:[
      {author:'Bobur T.',text:'Juda yaxshi g\'oya! AI qismi qanday ishlaydi?',time:'1 kun oldin'},
      {author:'Investor (TechVentures)',text:'Bu g\'oya biz izlayotgan narsaga o\'xshaydi. Aloqaga chiqamiz!',time:'12 soat oldin'},
    ],investorRating:4
  },
  {
    id:2,title:'MedConnect — Shifoxona platformasi',category:'health',
    desc:'Bemorlar va shifokorlarni ulaydi. Online navbat, tibbiy tarix, retseptlar — hammasi bitta ilovada. O\'zbekiston sharoitiga moslashtrilgan.',
    team:['Dilnoza Tosheva','Jasur Toshpulatov','Kamola Mirzayeva','Sherzod Raimov'],
    investment:'80,000$',likes:31,stars:5,comments:[
      {author:'Mohira X.',text:'Bu g\'oya juda dolzarb! O\'zbekistonda shifokorga navbat olish qiyin.',time:'2 kun oldin'},
    ],investorRating:5
  },
  {
    id:3,title:'AgriTech UZ — Qishloq xo\'jaligi AI',category:'tech',
    desc:'Fermerlar uchun AI yordamchi: tuproq tahlili, ob-havo bashorati, hosil optimizatsiyasi va bozor narxlari. Drone bilan integratsiya.',
    team:['Ulugbek Eshmatov','Feruza Sobirov','Zulfiya Nazarova'],
    investment:'120,000$',likes:18,stars:3,comments:[],investorRating:0
  },
  {
    id:4,title:'PayEasy — To\'lov agregatori',category:'fintech',
    desc:'Barcha to\'lov tizimlarini birlashtiradi: Click, Payme, Uzcard. QR kod bilan tezkor to\'lov va SME biznes uchun kassa tizimi.',
    team:['Bobur Tursunov','Mohira Xasanova','Alisher Azimov'],
    investment:'50,000$',likes:42,stars:4,comments:[
      {author:'Sardor U.',text:'Raqobat kuchli, lekin UX jihatdan farqlanish mumkin.',time:'3 kun oldin'},
    ],investorRating:4
  },
];

const QUIZ_QUESTIONS = [
  {q:'Python dasturlash tilida list nima?',opts:['O\'zgarmas to\'plam','O\'zgaruvchan tartibli to\'plam','Kalit-qiymat juftligi','Butun sonlar to\'plami'],ans:1},
  {q:'Big O notation nima uchun ishlatiladi?',opts:['Dizayn uchun','Algoritmning samaradorligini o\'lchash uchun','Ma\'lumotlar saqlash uchun','Tarmoq tezligini o\'lchash uchun'],ans:1},
  {q:'SQL da SELECT operatori nima qiladi?',opts:['Ma\'lumot o\'chiradi','Jadval yaratadi','Ma\'lumotlarni tanlaydi','Ma\'lumot qo\'shadi'],ans:2},
  {q:'HTTP va HTTPS farqi nima?',opts:['Tezlikda farq bor','HTTPS shifrlangan xavfsiz protokol','HTTP yangroq versiya','Hech qanday farq yo\'q'],ans:1},
  {q:'Git repository nima?',opts:['Faqat kod fayllar papkasi','Versiya nazorat tizimidagi loyiha', 'Internet sayt','Kompilator'],ans:1},
];

// ════════════════════════════════════
//  STATE
// ════════════════════════════════════
let currentUser = null;
let currentRole = null;
let selectedRole = null;
let currentPage = '';
let quizIdx = 0, quizScore = 0, quizAnswered = false;
let ideaFormVisible = false;
let currentTTGroup = 'CS-2301';
let currentDekScheduleGroup = 'CS-2301';

// ════════════════════════════════════
//  AUTH
// ════════════════════════════════════
function selectRole(role, el) {
  selectedRole = role;
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  const btn = document.getElementById('btnNext');
  if(btn){ btn.disabled = false; btn.style.opacity='1'; btn.style.cursor='pointer'; }
}
function goToLogin() {
  if (!selectedRole) return;
  showStep('step-' + selectedRole);
}
function backToRole() { showStep('step-role'); }
function showStep(id) {
  document.querySelectorAll('.auth-step').forEach(s => s.classList.remove('active'));
  var el = document.getElementById(id); if(el) el.classList.add('active');
}
function fillStudent(l,p,c,g){
  document.getElementById('sLogin').value=l;
  document.getElementById('sPass').value=p;
  document.getElementById('sCourse').value=c;
  document.getElementById('sGroup').value=g;
}
function fillTeacher(l,p,d){
  document.getElementById('tLogin').value=l;
  document.getElementById('tPass').value=p;
  document.getElementById('tDept').value=d;
}
function fillDekanat(l,p){
  document.getElementById('dLogin').value=l;
  document.getElementById('dPass').value=p;
}
function fillInvestor(l,p,c){
  document.getElementById('iLogin').value=l;
  document.getElementById('iPass').value=p;
  document.getElementById('iCompany').value=c;
}
// ── Backend URL (Python server manzili) ──────────────────────
// Agar server boshqa portda ishlasa, shu yerda o'zgartiring
const BACKEND_URL = 'http://localhost:8000';

// ── Xavfsiz storage (sandbox va private rejimda ham ishlaydi) ──
const _mem = {};
function _lsGet(k) { try { return localStorage.getItem(k); } catch(e) { return _mem[k]||null; } }
function _lsSet(k,v) { try { localStorage.setItem(k,v); } catch(e) { _mem[k]=v; } }
function _lsDel(k) { try { localStorage.removeItem(k); } catch(e) { delete _mem[k]; } }
const _smem = {};
function _ssGet(k) { try { return sessionStorage.getItem(k); } catch(e) { return _smem[k]||null; } }
function _ssSet(k,v) { try { sessionStorage.setItem(k,v); } catch(e) { _smem[k]=v; } }
function _ssDel(k) { try { sessionStorage.removeItem(k); } catch(e) { delete _smem[k]; } }

// ── XAVFSIZLIK: login urinishlar soni (brute-force himoyasi) ──
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

function checkLockout(key) {
  try {
    const data = JSON.parse(_lsGet('idu_lockout_' + key) || '{}');
    if (data.lockedUntil && Date.now() < data.lockedUntil) {
      const left = Math.ceil((data.lockedUntil - Date.now()) / 1000);
      return `Tizim ${left} soniyaga bloklangan. Iltimos kuting.`;
    }
  } catch(e) {}
  return null;
}
function recordFailedAttempt(key) {
  try {
    const data = JSON.parse(_lsGet('idu_lockout_' + key) || '{}');
    data.attempts = (data.attempts || 0) + 1;
    data.lastAttempt = Date.now();
    if (data.attempts >= MAX_ATTEMPTS) { data.lockedUntil = Date.now() + LOCKOUT_MS; data.attempts = 0; }
    _lsSet('idu_lockout_' + key, JSON.stringify(data));
  } catch(e) {}
}
function clearAttempts(key) { try { _lsDel('idu_lockout_' + key); } catch(e) {} }

// ── Parolni localStorage da o'qish (override qilingan bo'lsa) ──
function getEffectivePass(role, login) {
  try {
    const overrides = JSON.parse(_lsGet('idu_pass_overrides') || '{}');
    return overrides[role + ':' + login] || null;
  } catch(e){ return null; }
}
function setPassOverride(role, login, newPass) {
  try {
    const overrides = JSON.parse(_lsGet('idu_pass_overrides') || '{}');
    overrides[role + ':' + login] = newPass;
    _lsSet('idu_pass_overrides', JSON.stringify(overrides));
  } catch(e){}
}

// ════════════════════════════════════
//  OTP TIZIMI (ikki bosqichli tasdiqlash)
// ════════════════════════════════════
let _otpCode = null;
let _otpRole = null;
let _otpUser = null;
let _otpRemember = false;
let _otpPhone = null;
let _resendInterval = null;

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function showOTPStep(role, user, phone, remember) {
  _otpRole = role; _otpUser = user; _otpRemember = remember; _otpPhone = phone;

  // Telefon raqamni saqlash
  if (phone) {
    user.phone = '998' + phone;
    _lsSet('idu_phone_' + role + ':' + user.login, '998' + phone);
  }

  const fullPhone = '998' + phone;
  const masked = '+998 ' + phone.slice(0,2) + ' *** ** ' + phone.slice(-2);
  document.getElementById('otpPhoneShow').textContent = masked;
  document.getElementById('otpDemoBox').style.display = 'none';
  document.getElementById('otpInput').value = '';
  document.getElementById('otpError').classList.remove('show');
  showStep('step-otp');

  // Backend ga OTP so'rovi
  try {
    const res = await fetch(BACKEND_URL + '/api/send-otp', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phone: fullPhone, purpose: 'login' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Xato');
    // Demo rejim: kodni ko'rsatish
    if (data.demo && data.demo_code) {
      document.getElementById('otpDemoCode').textContent = data.demo_code;
      document.getElementById('otpDemoBox').style.display = 'flex';
      _otpCode = data.demo_code; // demo uchun lokal ham saqlanadi
    }
  } catch(e) {
    // Backend ulana olmasa — lokal demo rejim
    _otpCode = generateOTP();
    document.getElementById('otpDemoCode').textContent = _otpCode;
    document.getElementById('otpDemoBox').style.display = 'flex';
  }

  startResendTimer();
  setTimeout(() => document.getElementById('otpInput').focus(), 300);
}

function startResendTimer() {
  clearInterval(_resendInterval);
  let sec = 60;
  document.getElementById('resendLink').style.display = 'none';
  document.getElementById('resendTimer').style.display = 'inline';
  document.getElementById('resendCount').textContent = sec;
  _resendInterval = setInterval(() => {
    sec--;
    document.getElementById('resendCount').textContent = sec;
    if (sec <= 0) {
      clearInterval(_resendInterval);
      document.getElementById('resendLink').style.display = 'inline';
      document.getElementById('resendTimer').style.display = 'none';
    }
  }, 1000);
}

async function resendOTP() {
  const fullPhone = '998' + _otpPhone;
  document.getElementById('otpInput').value = '';
  document.getElementById('otpError').classList.remove('show');
  startResendTimer();
  try {
    const res = await fetch(BACKEND_URL + '/api/send-otp', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phone: fullPhone, purpose: 'login' })
    });
    const data = await res.json();
    if (data.demo && data.demo_code) {
      _otpCode = data.demo_code;
      document.getElementById('otpDemoCode').textContent = _otpCode;
      document.getElementById('otpDemoBox').style.display = 'flex';
    }
  } catch(e) {
    _otpCode = generateOTP();
    document.getElementById('otpDemoCode').textContent = _otpCode;
    document.getElementById('otpDemoBox').style.display = 'flex';
  }
  showToast('📨', 'SMS', 'Yangi kod yuborildi!');
}

async function verifyLoginOTP() {
  const entered = document.getElementById('otpInput').value.trim();
  if (!entered || entered.length !== 6) {
    document.getElementById('otpError').classList.add('show');
    return;
  }
  const btn = document.querySelector('#step-otp .btn-auth');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Tekshirilmoqda...'; }

  try {
    const fullPhone = '998' + _otpPhone;
    const res = await fetch(BACKEND_URL + '/api/verify-otp', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phone: fullPhone, code: entered, purpose: 'login' })
    });
    const data = await res.json();
    if (!res.ok) {
      document.getElementById('otpError').classList.add('show');
      document.getElementById('otpInput').value = '';
      document.getElementById('otpInput').focus();
      if (btn) { btn.disabled = false; btn.textContent = '✅ Tasdiqlash va kirish'; }
      return;
    }
    // Muvaffaqiyat
    document.getElementById('otpError').classList.remove('show');
    clearInterval(_resendInterval);
    if (_otpRemember) saveSession(_otpRole, _otpUser);
    launchApp(_otpRole, _otpUser);
  } catch(e) {
    // Backend yo'q — lokal demo tekshirish
    if (entered !== _otpCode) {
      document.getElementById('otpError').classList.add('show');
      document.getElementById('otpInput').value = '';
      document.getElementById('otpInput').focus();
      if (btn) { btn.disabled = false; btn.textContent = '✅ Tasdiqlash va kirish'; }
      return;
    }
    document.getElementById('otpError').classList.remove('show');
    clearInterval(_resendInterval);
    if (_otpRemember) saveSession(_otpRole, _otpUser);
    launchApp(_otpRole, _otpUser);
  }
  if (btn) { btn.disabled = false; btn.textContent = '✅ Tasdiqlash va kirish'; }
}

function backFromOTP() {
  clearInterval(_resendInterval);
  showStep('step-' + _otpRole);
}

// ── Telefon raqamni olish va OTP yuborish ──
function getPhoneFromInput(role) {
  const ids = { student: 'sPhone', teacher: 'tPhone', dekanat: 'dPhone' };
  const el = document.getElementById(ids[role]);
  return el ? el.value.trim().replace(/\D/g,'') : '';
}

// ════ YANGI AUTO-LOGIN TIZIMI ════
function doAutoLogin() {
  const l = document.getElementById('mainLogin').value.trim();
  const p = document.getElementById('mainPass').value.trim();
  const errEl = document.getElementById('mainLoginError');
  const errMsg = document.getElementById('mainLoginErrorMsg');
  if (!l) { errMsg.textContent = 'Login kiriting'; errEl.classList.add('show'); document.getElementById('mainLogin').focus(); return; }
  if (!p) { errMsg.textContent = 'Parol kiriting'; errEl.classList.add('show'); document.getElementById('mainPass').focus(); return; }

  const btn = document.getElementById('loginSubmitBtn');
  if (btn) { btn.innerHTML = '<span>Kirish...</span>'; btn.disabled = true; }

  const email = l.includes('@') ? l : l + '@idu.uz';

  // Try API first
  apiLogin('auto', email, p, false).then(function(res) {
    if (res.ok) {
      if (btn) { btn.innerHTML = '<span>Kirish</span><span style="font-size:16px">&rarr;</span>'; btn.disabled = false; }
      errEl.classList.remove('show');
      // Map API role → local user object
      const role = res.user.role;
      const u = { login: l, name: res.user.name, role: role,
                  group: 'CS-2301', gpa: 0, phone: res.user.phone || '' };
      launchApp(role, u);
    } else {
      // Offline or wrong password — fall back to local
      const roles = ['student','teacher','dekanat','investor'];
      var found = false;
      for (var i = 0; i < roles.length; i++) {
        const role = roles[i];
        const list = USERS[role] || [];
        const u = list.find(function(x){ return x.login === l && x.pass === p; });
        if (u) {
          found = true;
          errEl.classList.remove('show');
          if (btn) { btn.innerHTML = '<span>Kirish</span><span style="font-size:16px">&rarr;</span>'; btn.disabled = false; }
          launchApp(role, u);
          break;
        }
      }
      if (!found) {
        if (btn) { btn.innerHTML = '<span>Kirish</span><span style="font-size:16px">&rarr;</span>'; btn.disabled = false; }
        errMsg.textContent = res.error || "Login yoki parol noto'g'ri";
        errEl.classList.add('show');
        document.getElementById('mainLogin').select();
      }
    }
  }).catch(function() {
    if (btn) { btn.innerHTML = '<span>Kirish</span><span style="font-size:16px">&rarr;</span>'; btn.disabled = false; }
    const roles = ['student','teacher','dekanat','investor'];
    var found = false;
    for (var i = 0; i < roles.length; i++) {
      const role = roles[i];
      const list = USERS[role] || [];
      const u = list.find(function(x){ return x.login === l && x.pass === p; });
      if (u) { found = true; errEl.classList.remove('show'); launchApp(role, u); break; }
    }
    if (!found) {
      errMsg.textContent = "Login yoki parol noto'g'ri";
      errEl.classList.add('show');
    }
  });
}

function fillMainLogin(login, pass) {
  const lEl = document.getElementById('mainLogin');
  const pEl = document.getElementById('mainPass');
  if (lEl) lEl.value = login;
  if (pEl) { pEl.value = pass; pEl.type = 'password'; }
  const eyeBtn = document.getElementById('eyeBtn');
  if (eyeBtn) eyeBtn.innerHTML = '&#x1F441;';
  const errEl = document.getElementById('mainLoginError');
  if (errEl) errEl.classList.remove('show');
}

function togglePassEye() {
  const pEl = document.getElementById('mainPass');
  const btn = document.getElementById('eyeBtn');
  if (!pEl) return;
  if (pEl.type === 'password') {
    pEl.type = 'text';
    if (btn) btn.innerHTML = '&#x1F648;';
  } else {
    pEl.type = 'password';
    if (btn) btn.innerHTML = '&#x1F441;';
  }
}


// ── v18: API-first login with local USERS fallback ────────────────────────────

function _setLoginLoading(btnId, loading) {
  var btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? '0.6' : '1';
}

function loginStudent() {
  const l=document.getElementById('sLogin').value.trim();
  const p=document.getElementById('sPass').value.trim();
  const phone = getPhoneFromInput('student');
  const errEl = document.getElementById('studentError');

  const lockMsg = checkLockout('student:' + l);
  if (lockMsg) { errEl.querySelector('span').textContent=lockMsg; errEl.classList.add('show'); return; }
  if (!p) { errEl.querySelector('span').textContent='Parolni kiriting'; errEl.classList.add('show'); return; }
  if (!phone || phone.length < 9) { errEl.querySelector('span').textContent='📱 Telefon raqamni to\'g\'ri kiriting'; errEl.classList.add('show'); return; }

  _setLoginLoading('sLoginBtn', true);
  const remember = document.getElementById('sRemember').checked;

  // Build email from login (if not already email format, append domain)
  const email = l.includes('@') ? l : l + '@idu.uz';

  apiLogin('student', email, p, remember).then(function(res) {
    _setLoginLoading('sLoginBtn', false);
    if (res.ok) {
      // API success: map API user to local user format
      const u = { login: l, name: res.user.name, phone: '998' + phone, role: 'student',
                  group: res.user.group || 'CS-2301', gpa: res.user.gpa || 0 };
      clearAttempts('student:' + l); errEl.classList.remove('show');
      showOTPStep('student', u, phone, remember);
    } else if (res.offline) {
      // Offline fallback — use local USERS
      const override = getEffectivePass('student', l);
      const u = USERS.student.find(x=>x.login===l&&(override?override===p:x.pass===p));
      if (!u) { recordFailedAttempt('student:'+l); errEl.querySelector('span').textContent='Login yoki parol noto\'g\'ri'; errEl.classList.add('show'); return; }
      clearAttempts('student:'+l); errEl.classList.remove('show');
      showOTPStep('student', u, phone, remember);
    } else {
      recordFailedAttempt('student:'+l);
      errEl.querySelector('span').textContent = res.error || 'Login yoki parol noto\'g\'ri';
      errEl.classList.add('show');
    }
  }).catch(function() {
    _setLoginLoading('sLoginBtn', false);
    // Network error — use local fallback
    const override = getEffectivePass('student', l);
    const u = USERS.student.find(x=>x.login===l&&(override?override===p:x.pass===p));
    if (!u) { recordFailedAttempt('student:'+l); errEl.querySelector('span').textContent='Login yoki parol noto\'g\'ri'; errEl.classList.add('show'); return; }
    clearAttempts('student:'+l); errEl.classList.remove('show');
    showOTPStep('student', u, phone, remember);
  });
}

function loginTeacher(){
  const l=document.getElementById('tLogin').value.trim();
  const p=document.getElementById('tPass').value.trim();
  const phone = getPhoneFromInput('teacher');
  const errEl = document.getElementById('teacherError');

  const lockMsg = checkLockout('teacher:' + l);
  if (lockMsg) { errEl.querySelector('span').textContent=lockMsg; errEl.classList.add('show'); return; }
  if (!phone || phone.length < 9) { errEl.querySelector('span').textContent='📱 Telefon raqamni to\'g\'ri kiriting'; errEl.classList.add('show'); return; }

  _setLoginLoading('tLoginBtn', true);
  const remember = document.getElementById('tRemember').checked;
  const email = l.includes('@') ? l : l + '@idu.uz';

  apiLogin('teacher', email, p, remember).then(function(res) {
    _setLoginLoading('tLoginBtn', false);
    if (res.ok) {
      const u = { login: l, name: res.user.name, phone: '998' + phone, dept: res.user.department || '' };
      clearAttempts('teacher:'+l); errEl.classList.remove('show');
      showOTPStep('teacher', u, phone, remember);
    } else if (res.offline) {
      const override = getEffectivePass('teacher', l);
      const u = USERS.teacher.find(x=>x.login===l&&(override?override===p:x.pass===p));
      if (!u) { recordFailedAttempt('teacher:'+l); errEl.querySelector('span').textContent='Login yoki parol noto\'g\'ri'; errEl.classList.add('show'); return; }
      clearAttempts('teacher:'+l); errEl.classList.remove('show');
      showOTPStep('teacher', u, phone, remember);
    } else {
      recordFailedAttempt('teacher:'+l);
      errEl.querySelector('span').textContent = res.error || 'Login yoki parol noto\'g\'ri';
      errEl.classList.add('show');
    }
  }).catch(function() {
    _setLoginLoading('tLoginBtn', false);
    const override = getEffectivePass('teacher', l);
    const u = USERS.teacher.find(x=>x.login===l&&(override?override===p:x.pass===p));
    if (!u) { recordFailedAttempt('teacher:'+l); errEl.querySelector('span').textContent='Login yoki parol noto\'g\'ri'; errEl.classList.add('show'); return; }
    clearAttempts('teacher:'+l); errEl.classList.remove('show');
    showOTPStep('teacher', u, phone, remember);
  });
}

function loginDekanat(){
  const l=document.getElementById('dLogin').value.trim();
  const p=document.getElementById('dPass').value.trim();
  const phone = getPhoneFromInput('dekanat');
  const errEl = document.getElementById('dekanatError');

  const lockMsg = checkLockout('dekanat:' + l);
  if (lockMsg) { errEl.querySelector('span').textContent=lockMsg; errEl.classList.add('show'); return; }
  if (!phone || phone.length < 9) { errEl.querySelector('span').textContent='📱 Telefon raqamni to\'g\'ri kiriting'; errEl.classList.add('show'); return; }

  _setLoginLoading('dLoginBtn', true);
  const remember = document.getElementById('dRemember').checked;
  const email = l.includes('@') ? l : l + '@idu.uz';

  apiLogin('dekanat', email, p, remember).then(function(res) {
    _setLoginLoading('dLoginBtn', false);
    if (res.ok) {
      const u = { login: l, name: res.user.name, phone: '998' + phone, role: 'Dekan yordamchisi' };
      clearAttempts('dekanat:'+l); errEl.classList.remove('show');
      showOTPStep('dekanat', u, phone, remember);
    } else if (res.offline) {
      const override = getEffectivePass('dekanat', l);
      const u = USERS.dekanat.find(x=>x.login===l&&(override?override===p:x.pass===p));
      if (!u) { recordFailedAttempt('dekanat:'+l); errEl.querySelector('span').textContent='Login yoki parol noto\'g\'ri'; errEl.classList.add('show'); return; }
      clearAttempts('dekanat:'+l); errEl.classList.remove('show');
      showOTPStep('dekanat', u, phone, remember);
    } else {
      recordFailedAttempt('dekanat:'+l);
      errEl.querySelector('span').textContent = res.error || 'Login yoki parol noto\'g\'ri';
      errEl.classList.add('show');
    }
  }).catch(function() {
    _setLoginLoading('dLoginBtn', false);
    const override = getEffectivePass('dekanat', l);
    const u = USERS.dekanat.find(x=>x.login===l&&(override?override===p:x.pass===p));
    if (!u) { recordFailedAttempt('dekanat:'+l); errEl.querySelector('span').textContent='Login yoki parol noto\'g\'ri'; errEl.classList.add('show'); return; }
    clearAttempts('dekanat:'+l); errEl.classList.remove('show');
    showOTPStep('dekanat', u, phone, remember);
  });
}

function loginInvestor(){
  const l=document.getElementById('iLogin').value.trim();
  const p=document.getElementById('iPass').value.trim();
  const override = getEffectivePass('investor', l);
  const u=USERS.investor.find(x=>x.login===l&&(override?override===p:x.pass===p));
  if(!u){document.getElementById('investorError').classList.add('show');return;}
  document.getElementById('investorError').classList.remove('show');
  u.company = document.getElementById('iCompany').value || u.company;
  launchApp('investor', u);
}

// ── Eski checkPhoneAndLaunch (endi ishlatilmaydi, qoldirildi) ──
let _pendingLaunchRole = null, _pendingLaunchUser = null;
function checkPhoneAndLaunch(role, user) {
  launchApp(role, user);
}
function savePhoneSetup() {
  const val = document.getElementById('setupPhone').value.trim();
  if (val.length < 9) { document.getElementById('setupPhoneError').style.display='block'; return; }
  document.getElementById('setupPhoneError').style.display='none';
  _lsSet('idu_phone_' + _pendingLaunchRole + ':' + _pendingLaunchUser.login, '998' + val);
  _pendingLaunchUser.phone = '998' + val;
  document.getElementById('phoneSetupModal').style.display='none';
  launchApp(_pendingLaunchRole, _pendingLaunchUser);
}
function skipPhoneSetup() {
  document.getElementById('phoneSetupModal').style.display='none';
  launchApp(_pendingLaunchRole, _pendingLaunchUser);
}

// ── Remember Me: sessiyani localStorage ga saqlash ──
function saveSession(role, user) {
  _lsSet('idu_session', JSON.stringify({role, login:user.login, ts:Date.now()}));
}
function loadSavedSession() {
  try {
    const s = JSON.parse(_lsGet('idu_session') || 'null');
    if (!s) return;
    if (Date.now() - s.ts > 7 * 24 * 3600 * 1000) { _lsDel('idu_session'); return; }
    const u = USERS[s.role] && USERS[s.role].find(x => x.login === s.login);
    if (u) {
      const storedPhone = _lsGet('idu_phone_' + s.role + ':' + s.login);
      if (storedPhone && !u.phone) u.phone = storedPhone;
      launchApp(s.role, u);
    }
  } catch(e){}
}

function launchApp(role, user) {
  // XAVFSIZLIK: Faqat to'g'ri rol tokenini saqlash
  _ssSet('idu_active_role', ROLE_TOKENS[role]);
  _ssSet('idu_active_login', user.login);

  currentRole = role; currentUser = user;
  document.getElementById('authScreen').style.display='none';
  const app=document.getElementById('appScreen');
  app.style.display='flex'; app.classList.add('visible');
  closeLoginModalForce();
  setupNav(role);
  setupSidebar(role);
  setupChip(role,user);
  const defPage = {student:'dashboard',teacher:'teacher-dashboard',dekanat:'dekanat-dashboard',investor:'investor-dashboard'}[role];
  showPage(defPage);
  initDates();
  const btn=document.getElementById('addIdeaBtn');
  if(btn) btn.style.display = (role==='student'||role==='dekanat') ? '' : 'none';
}

// XAVFSIZLIK: Sahifaga kirish tekshiruvi (talaba dekanat oynasini ochishga urinsa)
function secureShowPage(pageId) {
  const dekanatPages = ['dekanat-dashboard','dekanat-schedule','dekanat-students','dekanat-teachers','dekanat-grades','dekanat-attendance','dekanat-applications','dekanat-questions','dekanat-report'];
  if (dekanatPages.includes(pageId)) {
    const token = _ssGet('idu_active_role');
    if (token !== ROLE_TOKENS['dekanat']) {
      // Toast xabar: original showToast(icon, title, msg) formatida
      showSecurityToast('Sizda bu bo\'limga kirish huquqi yo\'q!');
      return false;
    }
  }
  return true;
}

// ── Mobile sidebar helpers (v18) ──────────────────────────────────────────────
function toggleMobileSidebar() {
  var sb   = document.querySelector('.sidebar');
  var bd   = document.getElementById('sidebarBackdrop');
  if (!sb) return;
  var open = sb.classList.toggle('mobile-open');
  if (bd) bd.classList.toggle('active', open);
}
function closeMobileSidebar() {
  var sb = document.querySelector('.sidebar');
  var bd = document.getElementById('sidebarBackdrop');
  if (sb) sb.classList.remove('mobile-open');
  if (bd) bd.classList.remove('active');
}
// Close mobile sidebar when a nav item is tapped
var _origShowPage = typeof showPage === 'function' ? showPage : null;
document.addEventListener('DOMContentLoaded', function() {
  // Patch showPage after it's defined to close sidebar on mobile
  var __origSP = window.showPage;
  if (__origSP) {
    window.showPage = function(p) {
      closeMobileSidebar();
      __origSP(p);
    };
  }
});

function logout(){
  currentUser=null; currentRole=null;
  _apiToken = null;
  try { localStorage.removeItem('idu_jwt'); } catch(e) {}
  _ssDel('idu_active_role');
  _ssDel('idu_active_login');
  _lsDel('idu_session');
  document.getElementById('appScreen').classList.remove('visible');
  document.getElementById('appScreen').style.display='none';
  document.getElementById('authScreen').style.display='flex';
  selectedRole=null;
  openLoginModal();
}

// ── Xavfsizlik toast xabari (original showToast dan alohida) ──
function showSecurityToast(msg) {
  showToast('🔒', 'Xavfsizlik', msg);
}

// ════════════════════════════════════
//  PAROLNI UNUTDIM funksiyalari
// ════════════════════════════════════
let _fpRole = null, _fpUser = null, _fpOtp = null;

function showForgotPassword(role) {
  _fpRole = role; _fpUser = null; _fpOtp = null;
  document.getElementById('fpPhone').value = '';
  document.getElementById('fpOtpInput').value = '';
  document.getElementById('fpNewPass').value = '';
  document.getElementById('fpNewPass2').value = '';
  document.getElementById('fpError').style.display = 'none';
  document.getElementById('fpOtpError').style.display = 'none';
  document.getElementById('fpPassError').style.display = 'none';
  showFpStep1();
  document.getElementById('forgotModal').style.display = 'flex';
  document.getElementById('loginModalBg').classList.remove('open');
}
function closeForgotModal() {
  document.getElementById('forgotModal').style.display = 'none';
}
function showFpStep1() {
  ['fp-step1','fp-step2','fp-step3','fp-step4'].forEach(id => document.getElementById(id).style.display = 'none');
  document.getElementById('fp-step1').style.display = 'block';
}
async function sendForgotOTP() {
  const rawPhone = document.getElementById('fpPhone').value.trim().replace(/\D/g,'');
  const fullPhone = '998' + rawPhone;

  // Foydalanuvchini topish (lokal)
  let found = null, foundRole = _fpRole;
  const searchRoles = _fpRole ? [_fpRole] : Object.keys(USERS);
  for (const r of searchRoles) {
    const u = (USERS[r]||[]).find(x => {
      const stored = _lsGet('idu_phone_' + r + ':' + x.login);
      return (x.phone === fullPhone) || (stored === fullPhone);
    });
    if (u) { found = u; foundRole = r; break; }
  }
  if (!found) { document.getElementById('fpError').style.display = 'flex'; return; }
  document.getElementById('fpError').style.display = 'none';
  _fpUser = found; _fpRole = foundRole;

  const masked = '+998 ' + rawPhone.slice(0,2) + ' *** ** ' + rawPhone.slice(-2);
  document.getElementById('fpPhoneDisplay').textContent = masked;
  document.getElementById('fpOtpDemo').style.display = 'none';

  // Backend ga OTP so'rovi
  try {
    const res = await fetch(BACKEND_URL + '/api/forgot-send', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phone: fullPhone, role: foundRole, login: found.login })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Xato');
    if (data.demo && data.demo_code) {
      _fpOtp = data.demo_code;
      document.getElementById('fpOtpDemo').textContent = _fpOtp;
      document.getElementById('fpOtpDemo').style.display = 'block';
    }
  } catch(e) {
    // Fallback: lokal demo
    _fpOtp = String(Math.floor(100000 + Math.random() * 900000));
    document.getElementById('fpOtpDemo').textContent = _fpOtp;
    document.getElementById('fpOtpDemo').style.display = 'block';
  }

  ['fp-step1','fp-step2','fp-step3','fp-step4'].forEach(id => document.getElementById(id).style.display='none');
  document.getElementById('fp-step2').style.display = 'block';
}

async function verifyOTP() {
  const entered = document.getElementById('fpOtpInput').value.trim();
  document.getElementById('fpOtpError').style.display = 'none';

  try {
    const fullPhone = '998' + document.getElementById('fpPhone').value.trim().replace(/\D/g,'');
    const res = await fetch(BACKEND_URL + '/api/forgot-verify', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ phone: fullPhone, code: entered, purpose: 'forgot' })
    });
    const data = await res.json();
    if (!res.ok) { document.getElementById('fpOtpError').style.display='block'; return; }

    // Yangi credentials backenddan keldi
    setPassOverride(_fpRole, _fpUser.login, data.new_password);
    document.getElementById('fpNewLogin').textContent = data.login;
    document.getElementById('fpCredPass').textContent = data.new_password;
    ['fp-step1','fp-step2','fp-step3','fp-step4'].forEach(id => document.getElementById(id).style.display='none');
    document.getElementById('fp-step4').style.display = 'block';
    showToast('✅', 'Ma\'lumotlar tayyor', 'Yangi parol SMS ga yuborildi!');

  } catch(e) {
    // Fallback: lokal tekshirish
    if (entered !== _fpOtp) { document.getElementById('fpOtpError').style.display='block'; return; }
    document.getElementById('fpOtpError').style.display='none';
    generateNewCredentialsLocal();
  }
}

function generateNewCredentialsLocal() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let newPass = '';
  for (let i = 0; i < 8; i++) newPass += chars[Math.floor(Math.random() * chars.length)];
  setPassOverride(_fpRole, _fpUser.login, newPass);
  document.getElementById('fpNewLogin').textContent = _fpUser.login;
  document.getElementById('fpCredPass').textContent = newPass;
  ['fp-step1','fp-step2','fp-step3','fp-step4'].forEach(id => document.getElementById(id).style.display='none');
  document.getElementById('fp-step4').style.display = 'block';
  showToast('✅', 'Ma\'lumotlar tayyor', 'Yangi login va parol tayyor!');
}

// ════════════════════════════════════
//  NAV
// ════════════════════════════════════
const NAV_TABS = {
  student: [
    {id:'dashboard',icon:'🏠',label:'Bosh sahifa',labelRu:'Главная'},
    {id:'timetable',icon:'📅',label:'Jadval',labelRu:'Расписание'},
    {id:'grades',icon:'📊',label:'Baholar',labelRu:'Оценки'},
    {id:'tasks',icon:'📝',label:'Vazifalar',labelRu:'Задания',badge:5},
    {id:'startup',icon:'🚀',label:'Startup',labelRu:'Стартап'},
    {id:'rating',icon:'🏆',label:'Reyting',labelRu:'Рейтинг'},
    {id:'aitutor',icon:'🤖',label:'AI Tutor',labelRu:'AI Репетитор'},
    {id:'professors',icon:'⭐',label:'Ustozlar',labelRu:'Преподаватели'},
    {id:'notifications',icon:'🔔',label:'Xabarlar',labelRu:'Уведомления',badge:3},
    {id:'sesiya-test',icon:'🧪',label:'Test Rejim',labelRu:'Пробный экзамен'},
    {id:'sesiya-real',icon:'📝',label:'Sesiya',labelRu:'Сессия'},
  ],
  teacher: [
    {id:'teacher-dashboard',icon:'🏠',label:'Bosh sahifa',labelRu:'Главная'},
    {id:'teacher-timetable',icon:'📅',label:'Mening jadvalim',labelRu:'Моё расписание'},
    {id:'teacher-students',icon:'👥',label:'Talabalar',labelRu:'Студенты'},
    {id:'teacher-grade',icon:'✏️',label:'Baholash',labelRu:'Оценивание'},
    {id:'teacher-attendance',icon:'📋',label:'Davomat',labelRu:'Посещаемость'},
    {id:'startup',icon:'🚀',label:'Startup',labelRu:'Стартап'},
    {id:'notifications',icon:'🔔',label:'Xabarlar',labelRu:'Уведомления',badge:2},
  ],
  dekanat: [
    {id:'dekanat-dashboard',icon:'🏛️',label:'Bosh sahifa',labelRu:'Главная'},
    {id:'dekanat-schedule',icon:'📅',label:'Jadval',labelRu:'Расписание'},
    {id:'dekanat-students',icon:'🎓',label:'Talabalar',labelRu:'Студенты'},
    {id:'dekanat-teachers',icon:'👨‍🏫',label:'O\'qituvchilar',labelRu:'Преподаватели'},
    {id:'dekanat-grades',icon:'📊',label:'Baholar',labelRu:'Оценки'},
    {id:'dekanat-attendance',icon:'📋',label:'Davomat',labelRu:'Посещаемость'},
    {id:'startup',icon:'🚀',label:'Startup',labelRu:'Стартап'},
    {id:'dekanat-applications',icon:'📬',label:'Arizalar',labelRu:'Заявки',badge:0,badgeId:'dekAppBadge'},
    {id:'dekanat-questions',icon:'📝',label:'Savollar',labelRu:'Вопросы'},
    {id:'dekanat-report',icon:'📈',label:'Hisobotlar',labelRu:'Отчёты'},
    {id:'dekanat-sesiya',icon:'🗝️',label:'Sesiya Boshqaruvi',labelRu:'Управление сессией'},
  ],
  investor: [
    {id:'investor-dashboard',icon:'💼',label:'Dashboard',labelRu:'Дашборд'},
    {id:'startup',icon:'🚀',label:'Startup G\'oyalar',labelRu:'Стартап-идеи'},
  ],
};
function _tl(t){ return (currentLang==='ru' && t.labelRu) ? t.labelRu : t.label; }
function setupNav(role){
  const base = NAV_TABS[role] || [];
  const extra = (typeof NAV_EXTRA!=='undefined' && NAV_EXTRA[role]) ? NAV_EXTRA[role] : [];
  const tabs = [...base, ...extra];
  document.getElementById('topnavTabs').innerHTML = tabs.map(t=>`
    <button class="topnav-tab" onclick="showPage('${t.id}')" id="tab-${t.id}">
      ${t.icon} ${_tl(t)}${t.badge?`<span class="tab-badge">${t.badge}</span>`:''}
    </button>`).join('');
}
function setupSidebar(role){
  const base = NAV_TABS[role] || [];
  const extra = (typeof NAV_EXTRA!=='undefined' && NAV_EXTRA[role]) ? NAV_EXTRA[role] : [];
  const isRu = currentLang==='ru';
  let html = '';
  if(role==='dekanat'){
    const sections = [
      {label:isRu?'ОСНОВНОЕ':'ASOSIY',items:base.slice(0,2)},
      {label:isRu?'ДАННЫЕ':"MA'LUMOTLAR",items:base.slice(2,6)},
      {label:isRu?'ДРУГОЕ':'BOSHQA',items:base.slice(6)}
    ];
    html = sections.map(sec=>`
      <div class="sidebar-section">
        <div class="sidebar-label">${sec.label}</div>
        ${sec.items.map(it=>`
          <button class="sidebar-item" onclick="showPage('${it.id}')" id="si-${it.id}">
            <span class="si-icon">${it.icon}</span>
            <span class="si-text">${_tl(it)}</span>
            ${it.badge?`<span class="si-badge">${it.badge}</span>`:''}
          </button>`).join('')}
      </div>`).join('');
  } else {
    html = `<div class="sidebar-section"><div class="sidebar-label">${isRu?'МЕНЮ':'MENYU'}</div>
      ${base.map(it=>`
        <button class="sidebar-item" onclick="showPage('${it.id}')" id="si-${it.id}">
          <span class="si-icon">${it.icon}</span>
          <span class="si-text">${_tl(it)}</span>
          ${it.badge?`<span class="si-badge">${it.badge}</span>`:''}
        </button>`).join('')}
    </div>`;
  }
  if(extra.length){
    html += `<div class="sidebar-divider"></div>
    <div class="sidebar-section"><div class="sidebar-label">${isRu?'ДОПОЛНИТЕЛЬНО':"QO'SHIMCHA"}</div>
      ${extra.map(it=>`
        <button class="sidebar-item" onclick="showPage('${it.id}')" id="si-${it.id}">
          <span class="si-icon">${it.icon}</span>
          <span class="si-text">${_tl(it)}</span>
        </button>`).join('')}
    </div>`;
  }
  if(role==='student'){
    html += `<div class="sidebar-divider"></div>
    <div style="padding:10px;background:var(--bg);border-radius:var(--r);border:1px solid var(--border)">
      <div style="font-size:10px;color:var(--text3);font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">${isRu?'УРОВЕНЬ':'DARAJA'}</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,var(--purple),#A78BFA);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:white" id="sidebarLevel">1</div>
        <div style="flex:1"><div style="font-size:12px;font-weight:600" id="sidebarLevelName">Yangi boshlovchi</div></div>
      </div>
      <div class="xp-bar-wrap"><div class="xp-bar-fill" id="sidebarXPBar" style="width:0%"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text3);margin-top:3px">
        <span id="sidebarXP">0 XP</span>
        <div class="coin-badge" style="font-size:10px;padding:1px 7px" id="sidebarCoins">🪙 0</div>
      </div>
    </div>`;
  }
  document.getElementById('appSidebar').innerHTML = html;
}
function setupChip(role,user){
  const colors={student:'#1B4FD8',teacher:'#16A34A',dekanat:'#7C3AED',investor:'#EA580C'};
  const roleLabelsUz={student:'Talaba',teacher:"O'qituvchi",dekanat:'Dekanat',investor:'Investor'};
  const roleLabelsRu={student:'Студент',teacher:'Преподаватель',dekanat:'Деканат',investor:'Инвестор'};
  const roleLabels = currentLang==='ru' ? roleLabelsRu : roleLabelsUz;
  document.getElementById('chipAvatar').style.background=colors[role]||'#666';
  document.getElementById('chipAvatar').textContent=(user.name||'?').split(' ').map(x=>x[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('chipName').textContent=user.name||user.login;
  document.getElementById('chipRole').textContent=roleLabels[role]||role;
}
function showPage(id){
  // XAVFSIZLIK: dekanat sahifalariga ruxsatsiz kirishni bloklash
  if (!secureShowPage(id)) return;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg=document.getElementById('page-'+id);
  if(pg) pg.classList.add('active');
  currentPage=id;
  document.querySelectorAll('.topnav-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(t=>t.classList.remove('active'));
  const tab=document.getElementById('tab-'+id);
  if(tab) tab.classList.add('active');
  const si=document.getElementById('si-'+id);
  if(si) si.classList.add('active');
  // Lazy render — original pages
  if(id==='timetable') renderTimetable();
  else if(id==='teacher-timetable') renderTeacherTimetable();
  else if(id==='grades') renderGrades();
  else if(id==='tasks') renderTasks();
  else if(id==='materials') renderMaterials();
  else if(id==='rating') renderRating();
  else if(id==='notifications') renderNotifications();
  else if(id==='startup') renderIdeas();
  else if(id==='teacher-students') renderStudentList();
  else if(id==='teacher-grade') loadGradeGroup();
  else if(id==='teacher-attendance') initAttendance();
  else if(id==='dekanat-students') renderDekanatStudents();
  else if(id==='dekanat-teachers') renderDekanatTeachers();
  else if(id==='dekanat-schedule') renderDekanatSchedule();
  else if(id==='dekanat-grades') renderDekanatGrades();
  else if(id==='dekanat-attendance') renderDekanatAttendance();
  else if(id==='dekanat-report') renderFullReport();
  else if(id==='dekanat-groups') renderGroupsPage();
  else if(id==='dekanat-applications') renderDekanatApplications();
  else if(id==='dekanat-questions') renderDekanatQuestions();
  else if(id==='my-applications') renderMyApplications();
  else if(id==='dekanat-dashboard') renderDekanatDashboard();
  else if(id==='investor-dashboard') renderInvestorDashboard();
  else if(id==='sesiya-test') renderSesiyaTest();
  else if(id==='sesiya-real') renderSesiyaReal();
  else if(id==='dekanat-sesiya') renderDekanatSesiya();
  // Lazy render — addon pages
  else if(id==='games') { if(typeof renderGameHub==='function') renderGameHub(); }
  else if(id==='gamification') { if(typeof renderGamification==='function') renderGamification(); }
  else if(id==='time') { if(typeof renderTimePage==='function') renderTimePage(); }
  else if(id==='idu-premium') { if(typeof renderPremiumPage==='function') renderPremiumPage(); }
  else if(id==='professors') { if(typeof renderProfessorsPage==='function') renderProfessorsPage(); }
}

// ════════════════════════════════════
//  DATES & INIT
// ════════════════════════════════════
const MONTHS_UZ=['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
const MONTHS_RU=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS_UZ=['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
const DAYS_RU=['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];

function _months(){ return currentLang==='ru'?MONTHS_RU:MONTHS_UZ; }
function _days(){ return currentLang==='ru'?DAYS_RU:DAYS_UZ; }

function initDates(){
  const d=new Date();
  const months=_months(); const days=_days();
  const ds=`${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  const el=document.getElementById('dashDate');if(el)el.textContent=ds;
  const tb=document.getElementById('todayBadge');if(tb)tb.textContent=`${d.getDate()} ${months[d.getMonth()]}`;
  const td=document.getElementById('teacherDashDate');if(td)td.textContent=ds;
  const ttb=document.getElementById('teacherTodayBadge');if(ttb)ttb.textContent=`${d.getDate()} ${months[d.getMonth()]}`;
  const ad=document.getElementById('attDate');if(ad)ad.value=d.toISOString().split('T')[0];
  renderDashboardSchedule();
  renderDashboardTasks();
  renderDashboardGrades();
  renderWeekNav();
  renderAtRisk();
  renderTeacherTodayFull();
}

function renderWeekNav(){
  const d=new Date(); const dow=d.getDay();
  const offset=ttWeekOffset||0;
  const monday=new Date(d); monday.setDate(d.getDate()-(dow===0?6:dow-1)+offset*7);
  const months=currentLang==='ru'?['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']:['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
  const daysW=_daysWeek(); const daysS=_daysShort();
  const el=document.getElementById('ttWeekNav');if(!el)return;
  el.innerHTML=daysW.map((day,i)=>{
    const dd=new Date(monday);dd.setDate(monday.getDate()+i);
    const isToday=dd.toDateString()===d.toDateString();
    return `<div class="week-cell${isToday?' today':''}" onclick="highlightDay(${i})">
      <div class="wc-day">${daysS[i]}</div>
      <div class="wc-num">${dd.getDate()}</div>
      <div class="wc-dots">
        ${(SCHEDULE[currentTTGroup]?.[i]||[]).filter(Boolean).map(l=>`<div class="wc-dot" style="background:${getDotColor(l.sub)}"></div>`).join('')}
      </div>
    </div>`;
  }).join('');
}
function getDotColor(sub){
  const map={'Matematika':'#3B82F6','Dasturlash':'#7C3AED','Ingliz tili':'#EA580C','Fizika':'#16A34A','Algoritmlar':'#DC2626','Algebra':'#0D9488'};
  return map[sub]||'#94A3B8';
}
function highlightDay(i){/* visual only */}

// ════════════════════════════════════
//  TIMETABLE (EduPage style)
// ════════════════════════════════════
function renderTimetable(){
  const grp = currentUser&&currentUser.group ? currentUser.group : 'AI-2301';
  currentTTGroup = grp;
  // Update week label
  const offset = ttWeekOffset || 0;
  const baseDate = new Date();
  const dow = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (dow===0?6:dow-1) + offset*7);
  const friday = new Date(monday); friday.setDate(monday.getDate()+4);
  const months=_months();
  const isRuLbl = currentLang==='ru';
  const lbl = document.getElementById('ttWeekLabel');
  if(lbl){
    const range=`${monday.getDate()} ${months[monday.getMonth()]} – ${friday.getDate()} ${months[friday.getMonth()]}`;
    if(offset===0) lbl.textContent=isRuLbl?`Текущая неделя: ${range}`:`Joriy hafta: ${range}`;
    else if(offset<0) lbl.textContent=isRuLbl?`${Math.abs(offset)} нед. назад: ${range}`:`${Math.abs(offset)} hafta oldin: ${range}`;
    else lbl.textContent=isRuLbl?`Через ${offset} нед.: ${range}`:`${offset} hafta keyin: ${range}`;
  }
  buildTTTable('ttHead','ttBody',grp,false);
  buildTTLegend(grp);
  renderWeekNav();
}
function renderTeacherTimetable(){
  // Show schedule for all groups where this teacher teaches
  buildTTTable('teacherTTHead','teacherTTBody','CS-2301');
}
function buildTTTable(headId,bodyId,grp,editable){
  const today=new Date().getDay(); // 0=Sun,1=Mon...
  const head=document.getElementById(headId);
  const body=document.getElementById(bodyId);
  if(!head||!body)return;
  // Week offset for week display label
  const weekOffset = ttWeekOffset || 0;
  const baseDate = new Date();
  const dow = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (dow===0?6:dow-1) + weekOffset*7);
  const months=currentLang==='ru'?['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек']:['Yan','Fev','Mar','Apr','May','Iyn','Iyl','Avg','Sen','Okt','Noy','Dek'];
  const daysW=_daysWeek();
  const vaqtPara=currentLang==='ru'?'Время / Пара':'Vaqt / Para';
  const paraWord=currentLang==='ru'?'-пара':'-para';
  head.innerHTML=`<tr>
    <th style="min-width:90px">${vaqtPara}</th>
    ${daysW.map((d,i)=>{
      const dd=new Date(monday);dd.setDate(monday.getDate()+i);
      const isToday=dd.toDateString()===baseDate.toDateString();
      return`<th class="${isToday?'tt-today-header':''}">${d}<div style="font-size:10px;font-weight:400;opacity:0.8;margin-top:2px">${dd.getDate()} ${months[dd.getMonth()]}</div></th>`;
    }).join('')}
  </tr>`;
  const sched=SCHEDULE[grp]||SCHEDULE['AI-2301']||[];
  body.innerHTML=TIMES.map((time,ti)=>`
    <tr>
      <td class="time-col"><div style="font-weight:700;font-size:12px">${ti+1}${paraWord}</div>${time}</td>
      ${DAYS.map((_,di)=>{
        const lesson=sched[ti]?.[di];
        if(editable){
          if(!lesson)return`<td><div class="tt-empty" onclick="openAddLessonModal(${di},${ti})" style="cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text4);font-size:20px;transition:all 0.15s" onmouseover="this.style.background='var(--primary-light)';this.style.color='var(--primary)'" onmouseout="this.style.background='';this.style.color='var(--text4)'">+</div></td>`;
          const cls=SUBJECTS_COLORS[lesson.sub]||'tt-blue';
          return`<td><div class="tt-cell ${cls}" onclick="openEditLessonModal(${di},${ti})" style="cursor:pointer;position:relative" title="Tahrirlash uchun bosing">
            <div class="tt-cell-subject">${lesson.sub}</div>
            <div class="tt-cell-teacher">👨‍🏫 ${lesson.teacher}</div>
            <div class="tt-cell-room">🚪 ${lesson.room}</div>
            <div style="font-size:9px;opacity:0.7;margin-top:2px">${_type(lesson.type)}</div>
            <div style="position:absolute;top:4px;right:4px;font-size:11px;opacity:0.6">✏️</div>
          </div></td>`;
        }
        if(!lesson)return`<td><div class="tt-empty"></div></td>`;
        const cls=SUBJECTS_COLORS[lesson.sub]||'tt-blue';
        return`<td><div class="tt-cell ${cls}" title="${lesson.sub} — ${lesson.teacher} — ${lesson.room}">
          <div class="tt-cell-subject">${lesson.sub}</div>
          <div class="tt-cell-teacher">👨‍🏫 ${lesson.teacher}</div>
          <div class="tt-cell-room">🚪 ${lesson.room}</div>
          <div style="font-size:9px;opacity:0.7;margin-top:2px">${lesson.type}</div>
        </div></td>`;
      }).join('')}
    </tr>`).join('');
}
function buildTTLegend(grp){
  const el=document.getElementById('ttLegend');if(!el)return;
  const sched=SCHEDULE[grp]||[];
  const seen={};
  sched.flat().filter(Boolean).forEach(l=>{if(!seen[l.sub])seen[l.sub]=l.sub});
  el.innerHTML=Object.keys(seen).map(sub=>{
    const cls=SUBJECTS_COLORS[sub]||'tt-blue';
    return`<div class="tt-cell ${cls}" style="min-height:auto;padding:4px 10px;font-size:12px;font-weight:700">${sub}</div>`;
  }).join('');
}
function setTTView(v,el){
  document.querySelectorAll('.filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
}

// Week offset for student timetable
let ttWeekOffset = 0;
function changeWeek(delta){
  if(delta===0){ ttWeekOffset=0; }
  else { ttWeekOffset += delta; }
  renderTimetable();
}

function renderDekanatSchedule(){
  const grp=document.getElementById('dekScheduleGroup')?.value||'AI-2301';
  currentDekScheduleGroup=grp;
  buildTTTable('dekTTHead','dekTTBody',grp,true); // editable=true
  renderRoomStatus(grp);
}
function renderRoomStatus(grp){
  const el=document.getElementById('roomStatusGrid');if(!el)return;
  const rooms=['Lab-AI','Lab-CS','Lab-IT','A-101','A-102','A-201','A-202','A-301','B-101','B-201','B-301'];
  const sched=SCHEDULE[grp]||[];
  const busyRooms=new Set(sched.flat().filter(Boolean).map(l=>l.room));
  el.innerHTML=rooms.map(room=>{
    const busy=busyRooms.has(room);
    return`<div style="padding:10px 12px;border-radius:var(--r);border:1.5px solid ${busy?'#86EFAC':'var(--border)'};background:${busy?'var(--green-light)':'var(--bg)'}">
      <div style="font-size:12px;font-weight:700;color:${busy?'var(--green)':'var(--text2)'}">${room}</div>
      <div style="font-size:10px;margin-top:3px;color:${busy?'var(--green)':'var(--text3)'}">${busy?'🔴 Band':'🟢 Bo\'sh'}</div>
    </div>`;
  }).join('');
}
function openAddLessonModal(dayIdx, timeIdx){
  const modal = document.getElementById('addLessonModal');
  modal.style.display = 'flex';
  document.getElementById('lessonModalTitle').textContent = '➕ Yangi dars qo\'shish';
  document.getElementById('lessonModalSub').textContent = 'Jadvalga yangi dars kiritish';
  document.getElementById('deleteLessonBtn').style.display = 'none';
  if(dayIdx !== undefined) document.getElementById('lessonDay').value = dayIdx;
  if(timeIdx !== undefined) document.getElementById('lessonTime').value = timeIdx;
  // pre-fill subject based on group
  const grp = document.getElementById('dekScheduleGroup')?.value || 'AI-2301';
  const subj = document.getElementById('lessonSubject');
  const aiSubs = ['Machine Learning','Python for AI','Deep Learning','Data Science','Computer Vision','Neural Networks','Natural Language Processing','Matematika (AI uchun)','Ingliz tili (Tech)'];
  const csSubs = ['Network Security','Ethical Hacking','Web Application Security','Kriptografiya','Digital Forensics','Cloud Security','IDS/IPS Tizimlari','Ingliz tili (Tech)'];
  const itSubs = ['Dasturlash Asoslari',"Ma'lumotlar Tuzilmasi",'Algoritmlar','Web Dasturlash',"Ma'lumotlar Bazasi",'Kompyuter Tarmoqlari','Operatsion Tizimlar','Ingliz tili (Tech)'];
  const dbSubs = ['Raqamli Marketing','E-Tijorat','Biznes Analitika','Raqamli Transformatsiya','Loyiha Boshqaruvi','Moliyaviy Texnologiyalar','Tadbirkorlik','Ingliz tili (Tech)'];
  const map = {'AI-2301':aiSubs,'CS-2301':csSubs,'IT-2301':itSubs,'DB-2301':dbSubs};
  const relevantSubs = map[grp] || aiSubs;
  // Highlight relevant subjects at top
  Array.from(subj.options).forEach(opt => {
    opt.style.fontWeight = relevantSubs.includes(opt.value) ? '700' : 'normal';
    opt.style.color = relevantSubs.includes(opt.value) ? 'var(--primary)' : '';
  });
}
function openEditLessonModal(dayIdx, timeIdx){
  const grp = document.getElementById('dekScheduleGroup')?.value || 'AI-2301';
  const lesson = SCHEDULE[grp]?.[timeIdx]?.[dayIdx];
  if(!lesson) { openAddLessonModal(dayIdx, timeIdx); return; }
  const modal = document.getElementById('addLessonModal');
  modal.style.display = 'flex';
  document.getElementById('lessonModalTitle').textContent = '✏️ Darsni tahrirlash';
  document.getElementById('lessonModalSub').textContent = `${['Dushanba','Seshanba','Chorshanba','Payshanba','Juma'][dayIdx]} · ${timeIdx+1}-para`;
  document.getElementById('deleteLessonBtn').style.display = 'flex';
  document.getElementById('editLessonDay').value = dayIdx;
  document.getElementById('editLessonTime').value = timeIdx;
  document.getElementById('lessonDay').value = dayIdx;
  document.getElementById('lessonTime').value = timeIdx;
  // Set existing values
  const subj = document.getElementById('lessonSubject');
  for(let i=0;i<subj.options.length;i++) if(subj.options[i].value===lesson.sub||subj.options[i].text===lesson.sub) subj.selectedIndex=i;
  const teacher = document.getElementById('lessonTeacher');
  for(let i=0;i<teacher.options.length;i++) if(lesson.teacher.includes(teacher.options[i].text.replace('Prof. ',''))) teacher.selectedIndex=i;
  const room = document.getElementById('lessonRoom');
  for(let i=0;i<room.options.length;i++) if(room.options[i].text===lesson.room) room.selectedIndex=i;
  const type = document.getElementById('lessonType');
  for(let i=0;i<type.options.length;i++) if(type.options[i].text===lesson.type) type.selectedIndex=i;
}
function closeAddLessonModal(){
  document.getElementById('addLessonModal').style.display = 'none';
}
function saveNewLesson(){
  const grp = document.getElementById('dekScheduleGroup')?.value || 'AI-2301';
  const dayIdx = parseInt(document.getElementById('lessonDay').value);
  const timeIdx = parseInt(document.getElementById('lessonTime').value);
  const sub = document.getElementById('lessonSubject').value;
  const teacher = document.getElementById('lessonTeacher').value;
  const room = document.getElementById('lessonRoom').value;
  const type = document.getElementById('lessonType').value;
  if(!SCHEDULE[grp]) SCHEDULE[grp] = Array(5).fill(null).map(()=>Array(5).fill(null));
  if(!SCHEDULE[grp][timeIdx]) SCHEDULE[grp][timeIdx] = Array(5).fill(null);
  SCHEDULE[grp][timeIdx][dayIdx] = {sub, teacher, room, type};
  closeAddLessonModal();
  showToast('✅','Saqlandi',`${sub} darsi jadvalga qo'shildi`);
  setTimeout(()=>renderDekanatSchedule(), 200);
}
function deleteLesson(){
  const grp = document.getElementById('dekScheduleGroup')?.value || 'AI-2301';
  const dayIdx = parseInt(document.getElementById('editLessonDay').value);
  const timeIdx = parseInt(document.getElementById('editLessonTime').value);
  if(SCHEDULE[grp]?.[timeIdx]) SCHEDULE[grp][timeIdx][dayIdx] = null;
  closeAddLessonModal();
  showToast('🗑️','O\'chirildi','Dars jadvaldan o\'chirildi');
  setTimeout(()=>renderDekanatSchedule(), 200);
}

// ════════════════════════════════════
//  DASHBOARD WIDGETS
// ════════════════════════════════════
function renderDashboardSchedule(){
  const el=document.getElementById('todaySchedule');if(!el)return;
  const grp=currentUser?.group||'CS-2301';
  const today=new Date().getDay()-1;
  const todayIdx=Math.max(0,Math.min(today,4));
  const lessons=(SCHEDULE[grp]||[])[todayIdx]||[];
  const items=lessons.map((l,i)=>l?`
    <div class="sched-item${i===1?' now':''}">
      ${i===1?`<div class="sched-now-label">${currentLang==='ru'?'СЕЙЧАС':'HOZIR'}</div>`:''}
      <div class="sched-stripe" style="background:${getDotColor(l.sub)}"></div>
      <div class="sched-time">${TIMES[i]}</div>
      <div class="sched-body">
        <div class="sched-name">${l.sub}</div>
        <div class="sched-meta">
          <span>👨‍🏫 ${l.teacher}</span>
          <span class="sched-room-tag">🚪 ${l.room}</span>
          <span style="font-size:10.5px;color:var(--text3)">${_type(l.type)}</span>
        </div>
      </div>
    </div>`:'').filter(Boolean).join('');
  const noClass = currentLang==='ru'?'Сегодня нет занятий':'Bugun dars yo\'q';
  el.innerHTML=items||`<div class="empty-state"><div class="empty-state-icon">😴</div><div>${noClass}</div></div>`;
}
function renderDashboardTasks(){
  const el=document.getElementById('upcomingTasks');if(!el)return;
  el.innerHTML=TASKS_DATA.slice(0,3).map(t=>`
    <div class="task-item">
      <div class="task-top">
        <div>
          <div class="task-subject" style="color:var(--primary)">${t.sub}</div>
          <div class="task-name">${t.name}</div>
          <div class="task-due">📅 ${t.due} · ${t.pts} ball</div>
        </div>
        <span class="task-badge tb-${t.type}">${currentLang==='ru'?{test:'Тест',lab:'Лаб',hw:'Д/З',project:'Проект'}[t.type]:{test:'Test',lab:'Lab',hw:'Uy',project:'Loyiha'}[t.type]}</span>
      </div>
    </div>`).join('');
}
function renderDashboardGrades(){
  const el=document.getElementById('recentGradesBody');if(!el)return;
  el.innerHTML=GRADES_DATA.slice(0,4).map(g=>{
    const total=g.jn+g.on+g.yn+g.mi;
    const {letter,cls}=getGrade(total);
    return`<tr>
      <td><strong>${g.sub}</strong></td>
      <td><span class="gc-comp gc-jn">${g.jn}</span></td>
      <td><span class="gc-comp gc-on">${g.on}</span></td>
      <td><span class="gc-comp gc-yn">${g.yn}</span></td>
      <td><span class="gc-comp gc-mi">${g.mi}</span></td>
      <td><strong>${total}</strong></td>
      <td><span class="grade-chip ${cls}">${letter}</span></td>
    </tr>`;
  }).join('');
}
function renderAtRisk(){
  const el=document.getElementById('atRiskStudents');if(!el)return;
  const risky=STUDENTS_DATA.filter(s=>s.att<85||s.avg<65);
  el.innerHTML=risky.slice(0,5).map(s=>`
    <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #F8FAFC">
      <div class="dt-avatar" style="background:${s.att<75?'#DC2626':'#EA580C'}">${s.name.split(' ').map(x=>x[0]).join('')}</div>
      <div style="flex:1">
        <div style="font-size:13.5px;font-weight:700">${s.name}</div>
        <div style="font-size:12px;color:var(--text2)">${s.group} · ${currentLang==='ru'?'Посещ.':'Davomat'}: ${s.att}% · ${currentLang==='ru'?'Балл':'Ball'}: ${s.avg}</div>
      </div>
      <span class="status-tag ${s.att<75?'st-warning':'st-neutral'}">${currentLang==='ru'?(s.att<75?'Критично':'Наблюдение'):(s.att<75?'Kritik':'Kuzatuv')}</span>
    </div>`).join('');
}
function renderTeacherTodayFull(){
  const el=document.getElementById('teacherTodayFull');if(!el)return;
  const todayIdx=Math.max(0,Math.min(new Date().getDay()-1,4));
  let lessons=[];
  Object.keys(SCHEDULE).forEach(grp=>{
    (SCHEDULE[grp][todayIdx]||[]).forEach((l,i)=>{
      if(l&&l.teacher.startsWith('Toshmatov'))lessons.push({...l,para:i,grp});
    });
  });
  if(!lessons.length){el.innerHTML=`<div style="color:var(--text3);font-size:13px">${currentLang==='ru'?'Сегодня нет занятий':'Bugun dars yo\'q yoki bu o\'qituvchiga dars tayinlanmagan'}</div>`;return;}
  el.innerHTML=lessons.map(l=>`
    <div class="sched-item" style="margin-bottom:8px">
      <div class="sched-stripe" style="background:${getDotColor(l.sub)}"></div>
      <div class="sched-time">${TIMES[l.para]}</div>
      <div class="sched-body">
        <div class="sched-name">${l.sub} — <span style="color:var(--primary);font-size:13px">${l.grp}</span></div>
        <div class="sched-meta">
          <span class="sched-room-tag">🚪 ${l.room}</span>
          <span style="font-size:10.5px;color:var(--text3)">${_type(l.type)}</span>
        </div>
      </div>
    </div>`).join('');
}

// ════════════════════════════════════
//  GRADES
// ════════════════════════════════════
function getGrade(total){
  if(total>=86)return{letter:'A (a\'lo)',cls:'gc-a'};
  if(total>=71)return{letter:'B (yaxshi)',cls:'gc-b'};
  if(total>=56)return{letter:'C (qoniq.)',cls:'gc-c'};
  if(total>=41)return{letter:'D (qoniq.)',cls:'gc-d'};
  return{letter:'F (qoniq.)',cls:'gc-f'};
}
let _stGradeFilter='all';
function filterGradesSt(f,btn){
  _stGradeFilter=f;
  document.querySelectorAll('#page-grades .xl-filter-chip').forEach(c=>c.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderGrades();
}
function renderGrades(){
  const el=document.getElementById('gradesBody');if(!el)return;
  const q=(document.getElementById('gradesSearch')?.value||'').toLowerCase();
  let sum=0,alo=0,good=0,fail=0,cnt=0;
  const data=GRADES_DATA.filter(g=>{
    if(q&&!g.sub.toLowerCase().includes(q))return false;
    const t=g.jn+g.on+g.yn+g.mi;
    if(_stGradeFilter==='alo')return t>=86;
    if(_stGradeFilter==='yaxshi')return t>=71&&t<86;
    if(_stGradeFilter==='qoniq')return t<71;
    return true;
  });
  el.innerHTML=data.map((g,idx)=>{
    const total=g.jn+g.on+g.yn+g.mi;
    sum+=total;cnt++;
    if(total>=86)alo++;else if(total>=71)good++;else if(total<55)fail++;
    const{letter,cls}=getGrade(total);
    const tc=total>=86?'#166534':total>=71?'#1E40AF':total>=56?'#92400E':'#991B1B';
    const tb=total>=86?'#DCFCE7':total>=71?'#DBEAFE':total>=56?'#FEF3C7':'#FEE2E2';
    const st=total>=86?'st-active':total>=56?'st-ok':total<55?'st-warning':'st-neutral';
    const stl=total>=86?"A'lo":total>=71?'Yaxshi':total>=56?'Qoniqarli':'Qoniqarsiz';
    const jb=g.jn>=25?'#D1FAE5':g.jn>=18?'#FEF9C3':'#FEE2E2';
    const ob=g.on>=17?'#D1FAE5':g.on>=12?'#FEF9C3':'#FEE2E2';
    const yb=g.yn>=25?'#D1FAE5':g.yn>=18?'#FEF9C3':'#FEE2E2';
    const mb=g.mi>=17?'#D1FAE5':g.mi>=12?'#FEF9C3':'#FEE2E2';
    return '<tr>'
      +'<td>'+(idx+1)+'</td>'
      +'<td class="xl-td-sub">'+g.sub+'</td>'
      +'<td class="xl-td-teacher">'+g.teacher+'</td>'
      +'<td class="xl-td-num"><span style="background:'+jb+';padding:2px 9px;border-radius:5px;font-weight:700">'+g.jn+'</span><span style="color:#9CA3AF;font-size:10px"> /30</span></td>'
      +'<td class="xl-td-num"><span style="background:'+ob+';padding:2px 9px;border-radius:5px;font-weight:700">'+g.on+'</span><span style="color:#9CA3AF;font-size:10px"> /20</span></td>'
      +'<td class="xl-td-num"><span style="background:'+yb+';padding:2px 9px;border-radius:5px;font-weight:700">'+g.yn+'</span><span style="color:#9CA3AF;font-size:10px"> /30</span></td>'
      +'<td class="xl-td-num"><span style="background:'+mb+';padding:2px 9px;border-radius:5px;font-weight:700">'+g.mi+'</span><span style="color:#9CA3AF;font-size:10px"> /20</span></td>'
      +'<td class="xl-td-total"><span style="background:'+tb+';color:'+tc+';padding:3px 10px;border-radius:6px;font-size:15px">'+total+'</span>'
        +'<div style="height:3px;background:#E5E7EB;border-radius:2px;margin-top:3px"><div style="height:3px;background:'+tc+';width:'+total+'%;border-radius:2px"></div></div></td>'
      +'<td class="xl-td-baho"><span class="grade-chip '+cls+'">'+letter+'</span></td>'
      +'<td class="xl-td-status"><span class="status-tag '+st+'">'+stl+'</span></td>'
      +'</tr>';
  }).join('');
  const avg=cnt?(sum/cnt).toFixed(1):'—';
  const ae=document.getElementById('avgScore');if(ae)ae.textContent=avg;
  const ec=document.getElementById('excellentCount');if(ec)ec.textContent=alo;
  const gc=document.getElementById('goodCountSt');if(gc)gc.textContent=good;
  const fc=document.getElementById('failCount');if(fc)fc.textContent=fail;
}
function exportStudentGrades(){
  let csv="Fan nomi,O'qituvchi,JN/30,ON/20,YN/30,MI/20,Jami/100,Baho\n";
  GRADES_DATA.forEach(g=>{
    const t=g.jn+g.on+g.yn+g.mi;
    csv+='"'+g.sub+'","'+g.teacher+'",'+g.jn+','+g.on+','+g.yn+','+g.mi+','+t+',"'+getGrade(t).letter+'"\n';
  });
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='baholar.csv';a.click();
  showToast('📥','Excel','Yuklab olindi');
}

// ════════════════════════════════════
//  TASKS
// ════════════════════════════════════
function renderTasks(filter='all'){
  const el=document.getElementById('tasksList');if(!el)return;
  const filtered=filter==='all'?TASKS_DATA:TASKS_DATA.filter(t=>t.type===filter);
  el.innerHTML=filtered.map(t=>`
    <div class="task-item">
      <div class="task-top">
        <div>
          <div class="task-subject" style="color:var(--primary)">${t.sub}</div>
          <div class="task-name">${t.name}</div>
          <div class="task-due">📅 Muddat: ${t.due}</div>
          <div class="task-pts">+${t.pts} ball</div>
        </div>
        <span class="task-badge tb-${t.type}">${{test:'Test',lab:'Lab',hw:'Uy ishi',project:'Loyiha'}[t.type]}</span>
      </div>
    </div>`).join('');
}
function filterTasks(f,el){
  document.querySelectorAll('#page-tasks .filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderTasks(f);
}

// ════════════════════════════════════
//  MATERIALS
// ════════════════════════════════════
const MATERIALS=[
  {sub:'Dasturlash',title:'Python OOP — 6-ma\'ruza',type:'lecture',icon:'📄',size:'2.4 MB'},
  {sub:'Matematika',title:'Integral hisoblash video',type:'video',icon:'🎥',size:'145 MB'},
  {sub:'Ingliz tili',title:'Business English — PDF',type:'pdf',icon:'📑',size:'1.8 MB'},
  {sub:'Fizika',title:'Elektromagnetizm — ma\'ruza',type:'lecture',icon:'📄',size:'3.1 MB'},
  {sub:'Algoritmlar',title:'Sorting algoritmlar video',type:'video',icon:'🎥',size:'98 MB'},
  {sub:'Matematika',title:'Algebra formulalar jadvali',type:'pdf',icon:'📑',size:'0.5 MB'},
];
function renderMaterials(filter='all'){
  const el=document.getElementById('materialsList');if(!el)return;
  const f=filter==='all'?MATERIALS:MATERIALS.filter(m=>m.type===filter);
  el.innerHTML=f.map(m=>`
    <div class="card" style="margin-bottom:10px;padding:14px 18px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="font-size:28px">${m.icon}</div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700;margin-bottom:2px">${m.title}</div>
          <div style="font-size:12px;color:var(--text2)">${m.sub} · ${m.size}</div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="showToast('📥','Yuklanmoqda','${m.title} yuklanmoqda...')">⬇ Yuklab olish</button>
      </div>
    </div>`).join('');
}
function filterMaterials(f,el){
  document.querySelectorAll('#page-materials .filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderMaterials(f);
}

// ════════════════════════════════════
//  RATING
// ════════════════════════════════════
function renderRating(){
  const el=document.getElementById('ratingList');if(!el)return;
  const sorted=[...STUDENTS_DATA].sort((a,b)=>b.avg-a.avg).slice(0,10);
  const colors=['#D97706','#94A3B8','#B45309','#1B4FD8','#16A34A','#7C3AED','#0D9488','#DB2777','#EA580C','#0EA5E9'];
  el.innerHTML=sorted.map((s,i)=>`
    <div class="rank-row${s.name===currentUser?.name?' me':''}">
      <div class="rank-pos${i<3?' rp-'+(i+1):''}">${i<3?['🥇','🥈','🥉'][i]:i+1}</div>
      <div class="rank-avatar" style="background:${colors[i]||'#666'}">${s.name.split(' ').map(x=>x[0]).join('')}</div>
      <div class="rank-info">
        <div class="rank-name">${s.name}${s.name===currentUser?.name?' (Siz)':''}</div>
        <div class="rank-dept">${s.group}</div>
      </div>
      <div class="rank-score">${s.avg}</div>
    </div>`).join('');
}

// ════════════════════════════════════
//  NOTIFICATIONS
// ════════════════════════════════════
function renderNotifications(){
  const el=document.getElementById('notifList');if(!el)return;
  el.innerHTML=NOTIFS.map(n=>`
    <div class="notif-item">
      <div class="notif-icon-wrap" style="background:${n.color}">${n.icon}</div>
      <div style="flex:1">
        <div class="notif-text"><span class="${n.unread?'notif-unread':''}">${n.title}</span> — ${n.text}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>`).join('');
}
function markAllRead(){
  NOTIFS.forEach(n=>n.unread=false);
  document.getElementById('notifCount').style.display='none';
  renderNotifications();
  showToast('✅','O\'qildi','Barcha bildirishnomalar o\'qildi');
}

// ════════════════════════════════════
//  TEACHER PAGES
// ════════════════════════════════════
function renderStudentList(){
  const el=document.getElementById('teacherStudentBody');if(!el)return;
  const grp=document.getElementById('studGroupFilter')?.value||'all';
  const list=grp==='all'?STUDENTS_DATA:STUDENTS_DATA.filter(s=>s.group===grp);
  el.innerHTML=list.map((s,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="dt-avatar" style="background:#1B4FD8">${s.name.split(' ').map(x=>x[0]).join('')}</div>
        <span>${s.name}</span>
      </div></td>
      <td><span class="card-badge cb-blue">${s.group}</span></td>
      <td><span class="font-mono">${s.avg}</span></td>
      <td><span class="${s.att<85?'status-tag st-warning':'status-tag st-active'}">${s.att}%</span></td>
      <td><span class="status-tag ${s.avg>=70&&s.att>=85?'st-active':s.avg>=55?'st-ok':'st-warning'}">${s.avg>=70&&s.att>=85?'A\'lo':'Qoniqarli'}</span></td>
      <td><button class="btn btn-secondary btn-sm" onclick="openStudentDetail(${s.id})">Ko'rish</button></td>
    </tr>`).join('');
}
const SAVED_GRADES={};
let _curSub='Machine Learning';
let _curGrp='AI-2301';
function loadGradeGroup(){
  const el=document.getElementById('gradeEntryBody');if(!el)return;
  _curGrp=document.getElementById('gradeGroupSelect')?.value||'AI-2301';
  _curSub=document.getElementById('gradeSubjectSelect')?.value||'Machine Learning';
  const tEl=document.getElementById('gradeEntryTitle');
  if(tEl)tEl.textContent='✏️ '+_curSub+' — '+_curGrp+' guruh';
  const students=STUDENTS_DATA.filter(s=>s.group===_curGrp);
  const palette=['#1B4FD8','#7C3AED','#0891B2','#16A34A','#D97706','#DC2626','#0F766E','#9333EA'];
  el.innerHTML=students.map(function(s,i){
    const key=s.id+'_'+_curSub;
    const sv=SAVED_GRADES[key];
    const jv=sv?sv.jn:Math.floor(Math.random()*11+19);
    const ov=sv?sv.on:Math.floor(Math.random()*7+13);
    const yv=sv?sv.yn:Math.floor(Math.random()*11+18);
    const mv=sv?sv.mi:Math.floor(Math.random()*7+12);
    const ini=s.name.split(' ').map(function(x){return x[0];}).join('');
    const col=palette[s.id%palette.length];
    return '<tr id="grade-row-'+s.id+'">'
      +'<td>'+(i+1)+'</td>'
      +'<td style="min-width:160px"><div style="display:flex;align-items:center;gap:8px">'
        +'<div style="background:'+col+';width:28px;height:28px;min-width:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">'+ini+'</div>'
        +'<span style="font-weight:600;font-size:13px">'+s.name+'</span></div></td>'
      +'<td style="text-align:center"><span class="card-badge cb-blue" style="font-size:11px">'+s.group+'</span></td>'
      +'<td class="xl-td-num"><input class="xl-num-input" type="number" min="0" max="30" value="'+jv+'" id="jn-'+s.id+'" oninput="calcTotal('+s.id+')"></td>'
      +'<td class="xl-td-num"><input class="xl-num-input" type="number" min="0" max="20" value="'+ov+'" id="on-'+s.id+'" oninput="calcTotal('+s.id+')"></td>'
      +'<td class="xl-td-num"><input class="xl-num-input" type="number" min="0" max="30" value="'+yv+'" id="yn-'+s.id+'" oninput="calcTotal('+s.id+')"></td>'
      +'<td class="xl-td-num"><input class="xl-num-input" type="number" min="0" max="20" value="'+mv+'" id="mi-'+s.id+'" oninput="calcTotal('+s.id+')"></td>'
      +'<td class="xl-td-total" id="total-'+s.id+'">—</td>'
      +'<td class="xl-td-baho" id="letter-'+s.id+'">—</td>'
      +'<td style="text-align:center"><button class="xl-save-btn" onclick="saveGrade('+s.id+')">💾 Saqlash</button></td>'
      +'</tr>';
  }).join('');
  students.forEach(function(s){calcTotal(s.id);});
  updateGradeFooter(students);
}
function calcTotal(id){
  const jn=parseInt(document.getElementById('jn-'+id)?.value)||0;
  const on=parseInt(document.getElementById('on-'+id)?.value)||0;
  const yn=parseInt(document.getElementById('yn-'+id)?.value)||0;
  const mi=parseInt(document.getElementById('mi-'+id)?.value)||0;
  const jinEl=document.getElementById('jn-'+id);
  const onEl=document.getElementById('on-'+id);
  const ynEl=document.getElementById('yn-'+id);
  const miEl=document.getElementById('mi-'+id);
  if(jinEl)jinEl.classList.toggle('over-limit',jn>30);
  if(onEl)onEl.classList.toggle('over-limit',on>20);
  if(ynEl)ynEl.classList.toggle('over-limit',yn>30);
  if(miEl)miEl.classList.toggle('over-limit',mi>20);
  const t=Math.min(jn,30)+Math.min(on,20)+Math.min(yn,30)+Math.min(mi,20);
  const tc=t>=86?'#166534':t>=71?'#1E40AF':t>=56?'#92400E':'#991B1B';
  const tb=t>=86?'#DCFCE7':t>=71?'#DBEAFE':t>=56?'#FEF3C7':'#FEE2E2';
  const tel=document.getElementById('total-'+id);
  const lel=document.getElementById('letter-'+id);
  if(tel)tel.innerHTML='<span style="background:'+tb+';color:'+tc+';padding:3px 12px;border-radius:6px;font-size:15px;font-weight:800">'+t+'</span><div style="height:3px;background:#E5E7EB;border-radius:2px;margin-top:3px"><div style="height:3px;background:'+tc+';width:'+t+'%;border-radius:2px"></div></div>';
  if(lel){var gr=getGrade(t);lel.innerHTML='<span class="grade-chip '+gr.cls+'">'+gr.letter+'</span>';}
  var students=STUDENTS_DATA.filter(function(s){return s.group===_curGrp;});
  updateGradeFooter(students);
}
function updateGradeFooter(students){
  var sum=0,alo=0,fail=0;
  students.forEach(function(s){
    var jn=parseInt(document.getElementById('jn-'+s.id)?.value)||0;
    var on=parseInt(document.getElementById('on-'+s.id)?.value)||0;
    var yn=parseInt(document.getElementById('yn-'+s.id)?.value)||0;
    var mi=parseInt(document.getElementById('mi-'+s.id)?.value)||0;
    var t=jn+on+yn+mi;sum+=t;
    if(t>=86)alo++;if(t<55)fail++;
  });
  var avg=students.length?(sum/students.length).toFixed(1):'—';
  var ce=document.getElementById('gradeEntryCount');if(ce)ce.textContent=students.length;
  var av=document.getElementById('gradeEntryAvg');if(av)av.textContent=avg;
  var al=document.getElementById('gradeEntryAlo');if(al)al.textContent=alo;
  var fa=document.getElementById('gradeEntryFail');if(fa)fa.textContent=fail;
}
function saveGrade(id){
  var jn=parseInt(document.getElementById('jn-'+id)?.value)||0;
  var on=parseInt(document.getElementById('on-'+id)?.value)||0;
  var yn=parseInt(document.getElementById('yn-'+id)?.value)||0;
  var mi=parseInt(document.getElementById('mi-'+id)?.value)||0;
  if(jn>30||on>20||yn>30||mi>20){showToast('⚠️','Xato','Ball limitdan oshib ketdi!');return;}
  SAVED_GRADES[id+'_'+_curSub]={jn:jn,on:on,yn:yn,mi:mi};
  var row=document.getElementById('grade-row-'+id);
  if(row){row.querySelectorAll('td').forEach(function(td){td.style.background='#D1FAE5';setTimeout(function(){td.style.background='';},700);});}
  var gd=GRADES_DATA.find(function(g){return g.sub===_curSub;});
  if(gd){gd.jn=jn;gd.on=on;gd.yn=yn;gd.mi=mi;}
  showToast('✅','Saqlandi','Baholar muvaffaqiyatli saqlandi');
}
function saveAllGrades(){
  var students=STUDENTS_DATA.filter(function(s){return s.group===_curGrp;});
  var err=false;
  students.forEach(function(s){
    var jn=parseInt(document.getElementById('jn-'+s.id)?.value)||0;
    var on=parseInt(document.getElementById('on-'+s.id)?.value)||0;
    var yn=parseInt(document.getElementById('yn-'+s.id)?.value)||0;
    var mi=parseInt(document.getElementById('mi-'+s.id)?.value)||0;
    if(jn>30||on>20||yn>30||mi>20){err=true;return;}
    SAVED_GRADES[s.id+'_'+_curSub]={jn:jn,on:on,yn:yn,mi:mi};
  });
  if(err){showToast('⚠️','Xato','Limitdan oshgan baholar mavjud!');return;}
  document.querySelectorAll('#gradeEntryBody tr').forEach(function(row){
    row.querySelectorAll('td').forEach(function(td){td.style.background='#D1FAE5';setTimeout(function(){td.style.background='';},800);});
  });
  showToast('✅','Barchasi saqlandi',_curSub+' — '+_curGrp+' baholar saqlandi');
}
function exportGrades(){
  var students=STUDENTS_DATA.filter(function(s){return s.group===_curGrp;});
  var csv='Fan,Guruh,Talaba,JN/30,ON/20,YN/30,MI/20,Jami/100,Baho\n';
  students.forEach(function(s){
    var jn=parseInt(document.getElementById('jn-'+s.id)?.value)||0;
    var on=parseInt(document.getElementById('on-'+s.id)?.value)||0;
    var yn=parseInt(document.getElementById('yn-'+s.id)?.value)||0;
    var mi=parseInt(document.getElementById('mi-'+s.id)?.value)||0;
    var t=jn+on+yn+mi;
    csv+='"'+_curSub+'","'+_curGrp+'","'+s.name+'",'+jn+','+on+','+yn+','+mi+','+t+',"'+getGrade(t).letter+'"\n';
  });
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=_curSub.replace(/ /g,'_')+'_'+_curGrp+'.csv';a.click();
  showToast('📥','Excel','Yuklab olindi');
}
function initAttendance(){
  const el=document.getElementById('attendanceBody');if(!el)return;
  const grp=document.getElementById('attGroupSelect')?.value||'CS-2301';
  const students=STUDENTS_DATA.filter(s=>s.group===grp);
  el.innerHTML=students.map((s,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${s.name}</td>
      <td>
        <select class="form-select" style="width:120px" id="att-${s.id}">
          <option value="keldi">✅ Keldi</option>
          <option value="kelmadi">❌ Kelmadi</option>
          <option value="kech">⏰ Kechikdi</option>
        </select>
      </td>
      <td>
        <select class="form-select" style="width:120px" id="att-reason-${s.id}">
          <option value="">—</option>
          <option value="sababli">Sababli</option>
          <option value="sababsiz">Sababsiz</option>
        </select>
      </td>
      <td><input class="form-input" style="width:160px" placeholder="Izoh..." id="att-note-${s.id}"></td>
    </tr>`).join('');
}
function saveAttendance(){showToast('✅','Saqlandi','Davomat muvaffaqiyatli saqlandi');}

// ════════════════════════════════════
//  DEKANAT
// ════════════════════════════════════
function renderDekanatDashboard(){
  renderGroupRanking();renderTopTeachers();
}
function renderGroupRanking(){
  const el=document.getElementById('groupRankingList');if(!el)return;
  const groups=[
    {name:'AI-2301',avg:83.5,count:25},
    {name:'CS-2301',avg:81.2,count:28},
    {name:'IT-2301',avg:75.4,count:27},
    {name:'DB-2301',avg:73.1,count:26},
  ];
  el.innerHTML=groups.map((g,i)=>`
    <div class="rank-row">
      <div class="rank-pos${i<3?' rp-'+(i+1):''}">${i+1}</div>
      <div class="rank-info">
        <div class="rank-name">${g.name}</div>
        <div class="rank-dept">${g.count} talaba</div>
      </div>
      <div class="rank-score">${g.avg}</div>
    </div>`).join('');
}
function renderTopTeachers(){
  const el=document.getElementById('topTeachersList');if(!el)return;
  el.innerHTML=TEACHERS_DATA.map((t,i)=>`
    <div class="rank-row">
      <div class="rank-pos${i<3?' rp-'+(i+1):''}">${i+1}</div>
      <div class="rank-avatar" style="background:#16A34A">${t.name.split(' ').map(x=>x[0]).join('')}</div>
      <div class="rank-info">
        <div class="rank-name">${t.name}</div>
        <div class="rank-dept">${t.dept}</div>
      </div>
      <div class="rank-score">⭐${t.rating}</div>
    </div>`).join('');
}
// Dynamic groups list (starts with defaults, dekanat can add more)
let GROUPS_LIST = [
  {name:'AI-2301', dir:"Sun'iy Intellekt", course:1, count:25},
  {name:'CS-2301', dir:'Kiberxavfsizlik', course:1, count:28},
  {name:'IT-2301', dir:'Computing & IT', course:1, count:27},
  {name:'DB-2301', dir:'Digital Business', course:1, count:26},
];

function getGroupNames(){ return GROUPS_LIST.map(g=>g.name); }

function renderDekanatStudents(){
  filterStudents();
}
function filterStudents(){
  const q=document.getElementById('studentSearch')?.value.toLowerCase()||'';
  const grp=document.getElementById('studentGroupFilter')?.value||'';
  const el=document.getElementById('dekanatStudentBody');if(!el)return;
  const filtered=STUDENTS_DATA.filter(s=>(s.name.toLowerCase().includes(q)||s.group.toLowerCase().includes(q))&&(grp?s.group===grp:true));
  el.innerHTML=filtered.length ? filtered.map((s,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="dt-avatar" style="background:#1B4FD8">${s.name.split(' ').map(x=>x[0]).join('')}</div>
        <div><div style="font-weight:600">${s.name}</div></div>
      </div></td>
      <td><span class="card-badge cb-blue" style="cursor:pointer" onclick="openStudentEditModal(${s.id})">${s.group} ✏️</span></td>
      <td><span style="cursor:pointer;font-weight:600" onclick="openStudentEditModal(${s.id})">${s.course}-kurs ✏️</span></td>
      <td><span class="font-mono">${s.avg}</span></td>
      <td><span class="status-tag ${s.att>=90?'st-active':s.att>=75?'st-ok':'st-warning'}">${s.att}%</span></td>
      <td><span class="font-mono">${s.gpa}</span></td>
      <td><span class="status-tag ${s.avg>=70&&s.att>=85?'st-active':s.avg>=55?'st-ok':'st-warning'}">${s.avg>=70&&s.att>=85?'Yaxshi':s.avg>=55?'Qoniqarli':'Xavfli'}</span></td>
      <td style="display:flex;gap:6px">
        <button class="btn btn-secondary btn-sm" onclick="openStudentEditModal(${s.id})" title="Tahrirlash">✏️</button>
        <button class="btn btn-secondary btn-sm" onclick="openStudentDetail(${s.id})" title="Batafsil">📋</button>
      </td>
    </tr>`).join('') :
    '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">Talaba topilmadi</td></tr>';
  // Update group filter dropdown dynamically
  const sel = document.getElementById('studentGroupFilter');
  if(sel){
    const cur = sel.value;
    sel.innerHTML = '<option value="">Barcha guruhlar</option>' + getGroupNames().map(g=>`<option value="${g}"${g===cur?' selected':''}>${g}</option>`).join('');
  }
}

// ── GROUPS PAGE ──
function renderGroupsPage(){
  renderGroupsOverview();
  renderGroupsStudentTable();
  populateMoveSelects();
}
function renderGroupsOverview(){
  const el=document.getElementById('groupsOverviewGrid');if(!el)return;
  el.innerHTML=GROUPS_LIST.map(g=>{
    const count=STUDENTS_DATA.filter(s=>s.group===g.name).length||g.count;
    const avg=STUDENTS_DATA.filter(s=>s.group===g.name).reduce((a,s)=>a+s.avg,0)/Math.max(1,STUDENTS_DATA.filter(s=>s.group===g.name).length)||0;
    const colors={'Sun\'iy Intellekt':'var(--purple)','Kiberxavfsizlik':'var(--red)','Computing & IT':'var(--primary)','Digital Business':'var(--orange)'};
    const color=colors[g.dir]||'var(--primary)';
    return`<div class="card" style="border-left:4px solid ${color};padding:18px 20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:18px;font-weight:800;color:${color}">${g.name}</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-secondary" onclick="openEditGroupModal('${g.name}')" title="Tahrirlash">✏️</button>
          <button class="btn btn-sm" style="background:var(--red-light);color:var(--red);border:1px solid #FCA5A5" onclick="deleteGroup('${g.name}')" title="O'chirish">🗑️</button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:8px">🎓 ${g.dir} · ${g.course}-kurs</div>
      <div style="display:flex;gap:16px">
        <div><div style="font-size:22px;font-weight:800;color:${color}">${count}</div><div style="font-size:11px;color:var(--text3)">Talaba</div></div>
        ${avg>0?`<div><div style="font-size:22px;font-weight:800;color:var(--green)">${avg.toFixed(1)}</div><div style="font-size:11px;color:var(--text3)">O'rt. ball</div></div>`:''}
      </div>
    </div>`;
  }).join('');
}
function renderGroupsStudentTable(){
  const el=document.getElementById('groupsStudentBody');if(!el)return;
  el.innerHTML=STUDENTS_DATA.map((s,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="dt-avatar" style="background:#1B4FD8">${s.name.split(' ').map(x=>x[0]).join('')}</div>
        <span style="font-weight:600">${s.name}</span>
      </div></td>
      <td>
        <select class="form-select" style="width:auto;padding:5px 10px;font-size:12px" onchange="quickChangeGroup(${s.id},this.value)">
          ${getGroupNames().map(g=>`<option value="${g}"${g===s.group?' selected':''}>${g}</option>`).join('')}
        </select>
      </td>
      <td>
        <select class="form-select" style="width:auto;padding:5px 10px;font-size:12px" onchange="quickChangeCourse(${s.id},this.value)">
          <option value="1"${s.course==1?' selected':''}>1-kurs</option>
          <option value="2"${s.course==2?' selected':''}>2-kurs</option>
          <option value="3"${s.course==3?' selected':''}>3-kurs</option>
          <option value="4"${s.course==4?' selected':''}>4-kurs</option>
        </select>
      </td>
      <td>${s.avg}</td>
      <td><span class="status-tag ${s.att>=90?'st-active':'st-warning'}">${s.att}%</span></td>
      <td><button class="btn btn-sm btn-secondary" onclick="openStudentEditModal(${s.id})">✏️ Tahrir</button></td>
    </tr>`).join('');
}
function populateMoveSelects(){
  const stuSel=document.getElementById('moveStudentSelect');
  const grpSel=document.getElementById('moveToGroup');
  if(stuSel) stuSel.innerHTML='<option value="">— Talabani tanlang —</option>'+STUDENTS_DATA.map(s=>`<option value="${s.id}">${s.name} (${s.group})</option>`).join('');
  if(grpSel) grpSel.innerHTML='<option value="">— Guruhni tanlang —</option>'+getGroupNames().map(g=>`<option>${g}</option>`).join('');
}
function quickChangeGroup(id, newGroup){
  const s=STUDENTS_DATA.find(s=>s.id===id);
  if(!s) return;
  const old=s.group; s.group=newGroup;
  showToast('✅','Guruh o\'zgardi',`${s.name}: ${old} → ${newGroup}`);
  renderGroupsOverview();
}
function quickChangeCourse(id, newCourse){
  const s=STUDENTS_DATA.find(s=>s.id===id);
  if(!s) return;
  s.course=parseInt(newCourse);
  showToast('✅','Kurs o\'zgardi',`${s.name}: ${newCourse}-kursga o'tkazildi`);
}
function moveStudentToGroup(){
  const sid=document.getElementById('moveStudentSelect')?.value;
  const grp=document.getElementById('moveToGroup')?.value;
  const course=document.getElementById('moveToCourse')?.value;
  if(!sid||!grp){ showToast('⚠️','Xato','Talaba va guruhni tanlang'); return; }
  const s=STUDENTS_DATA.find(s=>s.id==sid);
  if(!s){ showToast('⚠️','Xato','Talaba topilmadi'); return; }
  const old=s.group; s.group=grp; s.course=parseInt(course);
  showToast('✅','Ko\'chirildi',`${s.name} → ${grp}, ${course}-kurs`);
  renderGroupsPage();
}

// ── ADD/EDIT STUDENT MODAL ──
function openAddStudentModal(){
  document.getElementById('studentModalTitle').textContent='➕ Yangi talaba qo\'shish';
  document.getElementById('editStudentId').value='';
  document.getElementById('editStudentName').value='';
  document.getElementById('editStudentLogin').value='';
  document.getElementById('editStudentAvg').value='';
  document.getElementById('editStudentAtt').value='';
  document.getElementById('editStudentGroup').value='AI-2301';
  document.getElementById('editStudentCourse').value='1';
  document.getElementById('deleteStudentBtn').style.display='none';
  // Refresh group options
  const sel=document.getElementById('editStudentGroup');
  sel.innerHTML=getGroupNames().map(g=>`<option>${g}</option>`).join('');
  document.getElementById('studentEditModal').style.display='flex';
}
function openStudentEditModal(id){
  const s=STUDENTS_DATA.find(s=>s.id===id);
  if(!s) return;
  document.getElementById('studentModalTitle').textContent='✏️ Talabani tahrirlash';
  document.getElementById('editStudentId').value=id;
  document.getElementById('editStudentName').value=s.name;
  document.getElementById('editStudentLogin').value=s.name.split(' ').map(x=>x.toLowerCase()).join('')||'';
  document.getElementById('editStudentAvg').value=s.avg;
  document.getElementById('editStudentAtt').value=s.att;
  document.getElementById('deleteStudentBtn').style.display='flex';
  const grpSel=document.getElementById('editStudentGroup');
  grpSel.innerHTML=getGroupNames().map(g=>`<option${g===s.group?' selected':''}>${g}</option>`).join('');
  grpSel.value=s.group;
  document.getElementById('editStudentCourse').value=s.course;
  document.getElementById('studentEditModal').style.display='flex';
}
function closeStudentModal(){
  document.getElementById('studentEditModal').style.display='none';
}
function saveStudentEdit(){
  const id=parseInt(document.getElementById('editStudentId').value);
  const name=document.getElementById('editStudentName').value.trim();
  const group=document.getElementById('editStudentGroup').value;
  const course=parseInt(document.getElementById('editStudentCourse').value);
  const avg=parseFloat(document.getElementById('editStudentAvg').value)||0;
  const att=parseFloat(document.getElementById('editStudentAtt').value)||0;
  if(!name){ showToast('⚠️','Xato','Ism kiritish shart'); return; }
  if(id){
    const s=STUDENTS_DATA.find(s=>s.id===id);
    if(s){ s.name=name; s.group=group; s.course=course; s.avg=avg; s.att=att; s.gpa=+(avg/25).toFixed(1); }
    showToast('✅','Saqlandi',`${name} ma'lumotlari yangilandi`);
  } else {
    const newId=Math.max(...STUDENTS_DATA.map(s=>s.id))+1;
    STUDENTS_DATA.push({id:newId,name,group,course,avg,att,gpa:+(avg/25).toFixed(1)});
    showToast('✅','Qo\'shildi',`${name} talabalar ro'yxatiga qo'shildi`);
  }
  closeStudentModal();
  renderDekanatStudents();
  if(currentPage==='dekanat-groups') renderGroupsPage();
}
function deleteStudent(){
  const id=parseInt(document.getElementById('editStudentId').value);
  const s=STUDENTS_DATA.find(s=>s.id===id);
  if(!s) return;
  if(!confirm(`${s.name}ni o'chirishni tasdiqlaysizmi?`)) return;
  const idx=STUDENTS_DATA.findIndex(s=>s.id===id);
  STUDENTS_DATA.splice(idx,1);
  closeStudentModal();
  showToast('🗑️','O\'chirildi',`${s.name} ro'yxatdan o'chirildi`);
  renderDekanatStudents();
}

// ── ADD/EDIT GROUP MODAL ──
function openAddGroupModal(){
  document.getElementById('newGroupName').value='';
  document.getElementById('newGroupCount').value='25';
  document.getElementById('addGroupModal').style.display='flex';
}
function openEditGroupModal(name){
  const g=GROUPS_LIST.find(g=>g.name===name);if(!g)return;
  document.getElementById('newGroupName').value=g.name;
  document.getElementById('newGroupDir').value=g.dir;
  document.getElementById('newGroupCourse').value=g.course;
  document.getElementById('newGroupCount').value=g.count;
  document.getElementById('addGroupModal').style.display='flex';
}
function saveNewGroup(){
  const name=document.getElementById('newGroupName').value.trim().toUpperCase();
  const dir=document.getElementById('newGroupDir').value;
  const course=parseInt(document.getElementById('newGroupCourse').value);
  const count=parseInt(document.getElementById('newGroupCount').value)||25;
  if(!name){ showToast('⚠️','Xato','Guruh nomini kiriting'); return; }
  const existing=GROUPS_LIST.findIndex(g=>g.name===name);
  if(existing>=0){
    GROUPS_LIST[existing]={name,dir,course,count};
    showToast('✅','Yangilandi',`${name} guruhi yangilandi`);
  } else {
    GROUPS_LIST.push({name,dir,course,count});
    showToast('✅','Yaratildi',`${name} yangi guruh yaratildi`);
  }
  document.getElementById('addGroupModal').style.display='none';
  renderGroupsPage();
  // Also update all group dropdowns
  refreshAllGroupDropdowns();
}
function deleteGroup(name){
  const inUse=STUDENTS_DATA.some(s=>s.group===name);
  if(inUse){ showToast('⚠️','O\'chirib bo\'lmadi',`${name} guruhida talabalar bor. Avval ularni ko'chiring.`); return; }
  if(!confirm(`${name} guruhini o'chirishni tasdiqlaysizmi?`)) return;
  GROUPS_LIST=GROUPS_LIST.filter(g=>g.name!==name);
  showToast('🗑️','O\'chirildi',`${name} guruhi o'chirildi`);
  renderGroupsPage();
  refreshAllGroupDropdowns();
}
function refreshAllGroupDropdowns(){
  const groups=getGroupNames();
  // Update all group selects across the app
  ['studentGroupFilter','dekScheduleGroup','dekGradeGroup','dekAttGroup','gradeGroupSelect','attGroupSelect','studGroupFilter','editStudentGroup','moveToGroup'].forEach(id=>{
    const sel=document.getElementById(id);if(!sel)return;
    const cur=sel.value;
    const hasAll=sel.options[0]?.value===''||sel.options[0]?.text.includes('Barcha')||sel.options[0]?.text.includes('tanlang');
    const prefix=hasAll?[`<option value="">${sel.options[0].text}</option>`]:[];
    sel.innerHTML=prefix.join('')+groups.map(g=>`<option value="${g}">${g}</option>`).join('');
    if(groups.includes(cur)) sel.value=cur;
  });
}
function renderDekanatTeachers(){
  const el=document.getElementById('dekanatTeacherBody');if(!el)return;
  el.innerHTML=TEACHERS_DATA.map((t,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><div style="display:flex;align-items:center;gap:8px">
        <div class="dt-avatar" style="background:#16A34A">${t.name.split(' ').map(x=>x[0]).join('')}</div>
        ${t.name}
      </div></td>
      <td>${t.dept}</td>
      <td>${t.subjects.join(', ')}</td>
      <td>${t.groups.join(', ')}</td>
      <td>${t.hours}</td>
      <td>⭐ ${t.rating}</td>
      <td><span class="status-tag st-active">Faol</span></td>
    </tr>`).join('');
}
var _dekFilter='all';
function dekGradeFilter(f,btn){
  _dekFilter=f;
  document.querySelectorAll('#page-dekanat-grades .xl-filter-chip').forEach(function(c){c.classList.remove('active');});
  if(btn)btn.classList.add('active');
  renderDekanatGrades();
}
function renderDekanatGrades(){
  var el=document.getElementById('dekGradeBody');if(!el)return;
  var grp=document.getElementById('dekGradeGroup')?.value||'AI-2301';
  var subF=document.getElementById('dekGradeSub')?.value||'all';
  var q=(document.getElementById('dekGradeSearch')?.value||'').toLowerCase();
  var students=STUDENTS_DATA.filter(function(s){return s.group===grp;});
  var grades=subF==='all'?GRADES_DATA:GRADES_DATA.filter(function(g){return g.sub===subF;});
  var tEl=document.getElementById('dekGradeTitle');
  if(tEl)tEl.textContent='📊 '+grp+' — '+(subF==='all'?'Barcha fanlar':subF);
  var rows=[];var sum=0,cnt=0,alo=0,good=0,fail=0;
  var palette=['#1B4FD8','#7C3AED','#0891B2','#16A34A','#D97706','#DC2626','#0F766E','#9333EA'];
  students.forEach(function(s){
    if(q&&!s.name.toLowerCase().includes(q))return;
    grades.forEach(function(g){
      var key=s.id+'_'+g.sub;var sv=SAVED_GRADES[key];
      var jn=sv?sv.jn:g.jn,on=sv?sv.on:g.on,yn=sv?sv.yn:g.yn,mi=sv?sv.mi:g.mi;
      var total=jn+on+yn+mi;
      if(_dekFilter==='alo'&&total<86)return;
      if(_dekFilter==='yaxshi'&&(total<71||total>=86))return;
      if(_dekFilter==='fail'&&total>=55)return;
      sum+=total;cnt++;
      if(total>=86)alo++;else if(total>=71)good++;else if(total<55)fail++;
      var gr=getGrade(total);
      var tc=total>=86?'#166534':total>=71?'#1E40AF':total>=56?'#92400E':'#991B1B';
      var tb=total>=86?'#DCFCE7':total>=71?'#DBEAFE':total>=56?'#FEF3C7':'#FEE2E2';
      var ini=s.name.split(' ').map(function(x){return x[0];}).join('');
      var col=palette[s.id%palette.length];
      rows.push('<tr>'
        +'<td>'+cnt+'</td>'
        +'<td style="min-width:140px"><div style="display:flex;align-items:center;gap:7px">'
          +'<div style="background:'+col+';width:26px;height:26px;min-width:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">'+ini+'</div>'
          +'<span style="font-weight:600;font-size:12px">'+s.name+'</span></div></td>'
        +'<td style="min-width:150px;font-size:12px;color:#57606A">'+g.sub+'</td>'
        +'<td class="xl-td-num" style="background:#F5F3FF"><span style="font-weight:700;color:#6D28D9">'+jn+'</span><span style="color:#9CA3AF;font-size:10px"> /30</span></td>'
        +'<td class="xl-td-num" style="background:#EFF6FF"><span style="font-weight:700;color:#1E40AF">'+on+'</span><span style="color:#9CA3AF;font-size:10px"> /20</span></td>'
        +'<td class="xl-td-num" style="background:#F0FDF4"><span style="font-weight:700;color:#166534">'+yn+'</span><span style="color:#9CA3AF;font-size:10px"> /30</span></td>'
        +'<td class="xl-td-num" style="background:#FFFBEB"><span style="font-weight:700;color:#92400E">'+mi+'</span><span style="color:#9CA3AF;font-size:10px"> /20</span></td>'
        +'<td class="xl-td-total"><span style="background:'+tb+';color:'+tc+';padding:3px 10px;border-radius:6px;font-size:14px;font-weight:800">'+total+'</span></td>'
        +'<td class="xl-td-baho"><span class="grade-chip '+gr.cls+'">'+gr.letter+'</span></td>'
        +'</tr>');
    });
  });
  el.innerHTML=rows.join('');
  var avg=cnt?(sum/cnt).toFixed(1):'—';
  var dc=document.getElementById('dekGradeCount');if(dc)dc.textContent=cnt;
  var da=document.getElementById('dekGradeAvg');if(da)da.textContent=avg;
  var dal=document.getElementById('dekGradeAlo');if(dal)dal.textContent=alo;
  var dg=document.getElementById('dekGradeGood');if(dg)dg.textContent=good;
  var df=document.getElementById('dekGradeFail');if(df)df.textContent=fail;
  // Stats cards
  var sEl=document.getElementById('dekGradeStats');if(!sEl)return;
  sEl.innerHTML='<div class="stat-card"><div class="stat-card-top"><div class="stat-card-label">Talabalar</div><div class="stat-card-icon" style="background:var(--primary-light)">👥</div></div><div class="stat-card-val" style="color:var(--primary)">'+students.length+'</div><div class="stat-card-change sc-flat">'+grp+'</div><div class="stat-card-bar scb-blue"></div></div>'
   +'<div class="stat-card"><div class="stat-card-top"><div class="stat-card-label">O\'rtacha ball</div><div class="stat-card-icon" style="background:var(--green-light)">📊</div></div><div class="stat-card-val" style="color:var(--green)">'+avg+'</div><div class="stat-card-change sc-flat">Barcha fanlar</div><div class="stat-card-bar scb-green"></div></div>'
   +'<div class="stat-card"><div class="stat-card-top"><div class="stat-card-label">A\'lochilar</div><div class="stat-card-icon" style="background:var(--yellow-light)">⭐</div></div><div class="stat-card-val" style="color:var(--yellow)">'+alo+'</div><div class="stat-card-change sc-up">86+ ball</div><div class="stat-card-bar scb-orange"></div></div>'
   +'<div class="stat-card"><div class="stat-card-top"><div class="stat-card-label">Qoniqarsiz</div><div class="stat-card-icon" style="background:var(--red-light)">⚠️</div></div><div class="stat-card-val" style="color:var(--red)">'+fail+'</div><div class="stat-card-change sc-down">55 dan past</div><div class="stat-card-bar scb-red"></div></div>';
}
function exportDekanatGrades(){
  var grp=document.getElementById('dekGradeGroup')?.value||'AI-2301';
  var students=STUDENTS_DATA.filter(function(s){return s.group===grp;});
  var csv='Talaba,Guruh,Fan,JN/30,ON/20,YN/30,MI/20,Jami/100,Baho\n';
  students.forEach(function(s){
    GRADES_DATA.forEach(function(g){
      var key=s.id+'_'+g.sub;var sv=SAVED_GRADES[key];
      var jn=sv?sv.jn:g.jn,on=sv?sv.on:g.on,yn=sv?sv.yn:g.yn,mi=sv?sv.mi:g.mi;
      var t=jn+on+yn+mi;
      csv+='"'+s.name+'","'+grp+'","'+g.sub+'",'+jn+','+on+','+yn+','+mi+','+t+',"'+getGrade(t).letter+'"\n';
    });
  });
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=grp+'_baholar.csv';a.click();
  showToast('📥','Excel','Yuklab olindi');
}
function renderDekanatAttendance(){
  const el=document.getElementById('dekAttBody');if(!el)return;
  const data=[
    {name:'Bobur Tursunov',date:'2026-03-01',sub:'Dasturlash asoslari',status:'kelmadi',sabab:'Sababsiz'},
    {name:'Kamola Mirzayeva',date:'2026-03-02',sub:'Ingliz tili (Tech)',status:'kelmadi',sabab:'Sababli (shifoxona)'},
    {name:'Sardor Umarov',date:'2026-03-01',sub:'Machine Learning',status:'kechikdi',sabab:'—'},
    {name:'Nilufar Xasanova',date:'2026-03-03',sub:'Python for AI',status:'kelmadi',sabab:'Sababsiz'},
    {name:'Jasur Rахматов',date:'2026-03-04',sub:'Data Science',status:'kelmadi',sabab:'Sababli (oilaviy)'},
    {name:'Dilnoza Yunusova',date:'2026-03-04',sub:'Deep Learning',status:'kechikdi',sabab:'—'},
  ];
  el.innerHTML=data.map(d=>`<tr>
    <td>${d.name}</td><td>${d.date}</td><td>${d.sub}</td>
    <td><span class="status-tag ${d.status==='kelmadi'?'st-warning':d.status==='kechikdi'?'st-neutral':'st-active'}">${d.status}</span></td>
    <td style="font-size:12px;color:#64748B">${d.sabab}</td>
  </tr>`).join('');
}
function exportAttendance(){
  showToast('📤','Export','Davomat hisoboti Excel formatida yuklanmoqda...');
}

// ---- REPORT: tab switcher ----
function switchRTab(name, btn){
  document.querySelectorAll('.rtab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.report-panel').forEach(p=>p.classList.remove('active'));
  if(btn) btn.classList.add('active');
  var panel=document.getElementById('rpanel-'+name);
  if(panel) panel.classList.add('active');
  // render on demand
  if(name==='overview') renderFullReport();
  else if(name==='groups') renderGroupDetailReport();
  else if(name==='teachers') renderTeacherPerformance();
  else if(name==='risk') renderRiskStudents();
  else if(name==='compare') renderSemesterCompare();
}

function renderFullReport(){
  renderGradeDistribution();
  renderGroupAvgChart();
  renderSubjectAvgTable();
}

function renderGradeDistribution(){
  var el=document.getElementById('gradeDistribution');if(!el)return;
  // compute from real data
  var totals=[];
  STUDENTS_DATA.forEach(function(s){
    GRADES_DATA.forEach(function(g){
      var key=s.id+'_'+g.sub;var sv=SAVED_GRADES[key];
      var t=(sv?sv.jn:g.jn)+(sv?sv.on:g.on)+(sv?sv.yn:g.yn)+(sv?sv.mi:g.mi);
      totals.push(t);
    });
  });
  if(!totals.length) totals=[83,76,68,52,91,74,88,61,79,84,55,93,70,82,47,75];
  var alo=totals.filter(function(t){return t>=86;}).length;
  var yaxshi=totals.filter(function(t){return t>=71&&t<86;}).length;
  var qoniq=totals.filter(function(t){return t>=56&&t<71;}).length;
  var fail=totals.filter(function(t){return t<56;}).length;
  var total=totals.length;
  var data=[
    {l:"A'lo (86–100)",cnt:alo,pct:Math.round(alo/total*100),c:'#16A34A'},
    {l:'Yaxshi (71–85)',cnt:yaxshi,pct:Math.round(yaxshi/total*100),c:'#1B4FD8'},
    {l:'Qoniqarli (56–70)',cnt:qoniq,pct:Math.round(qoniq/total*100),c:'#D97706'},
    {l:'Qoniqarsiz (<56)',cnt:fail,pct:Math.round(fail/total*100),c:'#DC2626'}
  ];
  el.innerHTML=data.map(function(d){
    return '<div style="margin-bottom:14px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">'
        +'<span style="font-size:13px;color:#475569;font-weight:500">'+d.l+'</span>'
        +'<div style="display:flex;align-items:center;gap:10px">'
          +'<span style="font-size:11.5px;color:#94A3B8">'+d.cnt+' ta</span>'
          +'<span style="font-size:13px;font-weight:800;font-family:\'DM Mono\',monospace;color:'+d.c+'">'+d.pct+'%</span>'
        +'</div>'
      +'</div>'
      +'<div style="height:8px;background:#F1F5F9;border-radius:4px;overflow:hidden">'
        +'<div style="height:100%;background:'+d.c+';border-radius:4px;width:'+d.pct+'%;transition:width 0.6s ease"></div>'
      +'</div>'
    +'</div>';
  }).join('');
}

function renderGroupAvgChart(){
  var el=document.getElementById('groupAvgChart');if(!el)return;
  var groups=['AI-2301','CS-2301','IT-2301','DB-2301'];
  var colors=['#1B4FD8','#7C3AED','#16A34A','#EA580C'];
  var gdata=groups.map(function(grp,gi){
    var ss=STUDENTS_DATA.filter(function(s){return s.group===grp;});
    if(!ss.length) return {g:grp,avg:[76,81,75,73][gi],cnt:ss.length||38,c:colors[gi]};
    var sums=ss.map(function(s){
      return GRADES_DATA.reduce(function(acc,g){
        var key=s.id+'_'+g.sub;var sv=SAVED_GRADES[key];
        return acc+(sv?sv.jn:g.jn)+(sv?sv.on:g.on)+(sv?sv.yn:g.yn)+(sv?sv.mi:g.mi);
      },0)/GRADES_DATA.length;
    });
    var avg=parseFloat((sums.reduce(function(a,b){return a+b;},0)/sums.length).toFixed(1));
    return {g:grp,avg:avg,cnt:ss.length,c:colors[gi]};
  });
  var maxV=Math.max.apply(null,gdata.map(function(d){return d.avg;}))+8;
  el.innerHTML='<div style="display:flex;align-items:flex-end;gap:10px;height:120px;padding:0 8px;margin-bottom:8px">'
    +gdata.map(function(d){
      var h=Math.round((d.avg/maxV)*95);
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">'
        +'<span style="font-size:11px;font-weight:800;font-family:\'DM Mono\',monospace;color:'+d.c+'">'+d.avg+'</span>'
        +'<div style="width:100%;background:'+d.c+';border-radius:6px 6px 0 0;height:'+h+'px;opacity:0.88;transition:height 0.4s"></div>'
        +'<div style="font-size:9px;color:#94A3B8;text-align:center;line-height:1.3">'+d.g+'<br><span style="color:#CBD5E1">'+d.cnt+' ta</span></div>'
        +'</div>';
    }).join('')
  +'</div>';
}

function renderSubjectAvgTable(){
  var el=document.getElementById('subjectAvgTable');if(!el)return;
  var subjects=GRADES_DATA.map(function(g){return g.sub;});
  var rows=subjects.map(function(sub){
    var g=GRADES_DATA.find(function(x){return x.sub===sub;});
    if(!g) return null;
    var totals=STUDENTS_DATA.map(function(s){
      var key=s.id+'_'+sub;var sv=SAVED_GRADES[key];
      return (sv?sv.jn:g.jn)+(sv?sv.on:g.on)+(sv?sv.yn:g.yn)+(sv?sv.mi:g.mi);
    });
    var avg=parseFloat((totals.reduce(function(a,b){return a+b;},0)/totals.length).toFixed(1));
    var alo=totals.filter(function(t){return t>=86;}).length;
    var fail=totals.filter(function(t){return t<56;}).length;
    var tc=avg>=80?'#166534':avg>=65?'#1E40AF':'#991B1B';
    var tb=avg>=80?'#DCFCE7':avg>=65?'#DBEAFE':'#FEE2E2';
    return {sub:sub,avg:avg,alo:alo,fail:fail,tc:tc,tb:tb};
  }).filter(Boolean);
  rows.sort(function(a,b){return b.avg-a.avg;});
  el.innerHTML='<table style="width:100%;border-collapse:collapse;font-size:13px">'
    +'<thead><tr>'
      +'<th style="text-align:left;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">#</th>'
      +'<th style="text-align:left;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Fan nomi</th>'
      +'<th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">O\'rt. ball</th>'
      +'<th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">A\'lochilar</th>'
      +'<th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Qoniqarsiz</th>'
      +'<th style="padding:8px 12px;border-bottom:1.5px solid #E2E8F0"></th>'
    +'</tr></thead>'
    +'<tbody>'
    +rows.map(function(r,i){
      var barW=Math.round(r.avg);
      return '<tr>'
        +'<td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;color:#94A3B8;font-size:12px">'+(i+1)+'</td>'
        +'<td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;font-weight:600">'+r.sub+'</td>'
        +'<td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;text-align:center">'
          +'<span style="background:'+r.tb+';color:'+r.tc+';padding:3px 11px;border-radius:7px;font-weight:800;font-family:\'DM Mono\',monospace">'+r.avg+'</span>'
        +'</td>'
        +'<td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;text-align:center;color:#16A34A;font-weight:700">'+r.alo+'</td>'
        +'<td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;text-align:center;color:'+( r.fail>0?'#DC2626':'#94A3B8')+';font-weight:700">'+r.fail+'</td>'
        +'<td style="padding:10px 12px;border-bottom:1px solid #F8FAFC;min-width:120px">'
          +'<div style="height:5px;background:#F1F5F9;border-radius:3px;overflow:hidden">'
            +'<div style="height:100%;background:'+r.tc+';border-radius:3px;width:'+barW+'%"></div>'
          +'</div>'
        +'</td>'
      +'</tr>';
    }).join('')
    +'</tbody></table>';
}

function renderGroupDetailReport(){
  var el=document.getElementById('groupDetailReport');if(!el)return;
  var groups=['AI-2301','CS-2301','IT-2301','DB-2301'];
  var colors=['#1B4FD8','#7C3AED','#16A34A','#EA580C'];
  var html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">';
  groups.forEach(function(grp,gi){
    var ss=STUDENTS_DATA.filter(function(s){return s.group===grp;});
    if(!ss.length){ ss=[{id:99,name:'Demo',gpa:3.2,avg:75,att:92}]; }
    var avgs=ss.map(function(s){
      return GRADES_DATA.reduce(function(acc,g){
        var key=s.id+'_'+g.sub;var sv=SAVED_GRADES[key];
        return acc+(sv?sv.jn:g.jn)+(sv?sv.on:g.on)+(sv?sv.yn:g.yn)+(sv?sv.mi:g.mi);
      },0)/Math.max(GRADES_DATA.length,1);
    });
    var avg=avgs.length?(avgs.reduce(function(a,b){return a+b;},0)/avgs.length).toFixed(1):75;
    var alo=ss.filter(function(s){return s.avg>=86;}).length;
    var fail=ss.filter(function(s){return s.avg<56;}).length;
    var attAvg=(ss.reduce(function(a,s){return a+s.att;},0)/ss.length).toFixed(1);
    var gpaAvg=(ss.reduce(function(a,s){return a+(parseFloat(s.gpa)||3);},0)/ss.length).toFixed(2);
    var c=colors[gi];
    html+='<div class="card" style="border-top:3px solid '+c+'">'
      +'<div class="card-header">'
        +'<div class="card-title" style="color:'+c+'">'+grp+'</div>'
        +'<div class="card-badge" style="background:'+c+'22;color:'+c+'">'+ss.length+' talaba</div>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px">'
        +'<div style="text-align:center;padding:10px 4px;background:#F8FAFC;border-radius:8px">'
          +'<div style="font-size:18px;font-weight:900;color:'+c+';font-family:\'DM Mono\',monospace">'+avg+'</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">ORT. BALL</div>'
        +'</div>'
        +'<div style="text-align:center;padding:10px 4px;background:#F8FAFC;border-radius:8px">'
          +'<div style="font-size:18px;font-weight:900;color:#16A34A;font-family:\'DM Mono\',monospace">'+alo+'</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">A\'LOCHILAR</div>'
        +'</div>'
        +'<div style="text-align:center;padding:10px 4px;background:#F8FAFC;border-radius:8px">'
          +'<div style="font-size:18px;font-weight:900;color:#D97706;font-family:\'DM Mono\',monospace">'+attAvg+'%</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">DAVOMAT</div>'
        +'</div>'
        +'<div style="text-align:center;padding:10px 4px;background:#F8FAFC;border-radius:8px">'
          +'<div style="font-size:18px;font-weight:900;color:#7C3AED;font-family:\'DM Mono\',monospace">'+gpaAvg+'</div>'
          +'<div style="font-size:9px;color:#94A3B8;font-weight:600;margin-top:2px">GPA</div>'
        +'</div>'
      +'</div>'
      +(fail>0?'<div style="background:#FFF5F5;border:1px solid #FCA5A5;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#DC2626;display:flex;align-items:center;gap:6px">⚠️ '+fail+' talaba qoniqarsiz baho olgan — nazorat tavsiya etiladi</div>':'<div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:8px 12px;font-size:12.5px;color:#16A34A;display:flex;align-items:center;gap:6px">✅ Guruh barqaror ko\'rsatkichda</div>')
    +'</div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

function renderTeacherPerformance(){
  var tList=document.getElementById('teacherPerfList');
  var tLoad=document.getElementById('teacherLoadChart');
  var tBody=document.getElementById('teacherDetailBody');
  if(!tList||!tLoad||!tBody) return;
  var teachers=TEACHERS_DATA.length?TEACHERS_DATA:[
    {name:'Prof. Karimov J.',dept:'Sun\'iy intellekt',subjects:['Machine Learning','Deep Learning'],groups:['AI-2301','CS-2301'],hours:14,rating:4.8},
    {name:'Prof. Ergashev T.',dept:'Dasturlash',subjects:['Python for AI','Data Science'],groups:['AI-2301','IT-2301'],hours:12,rating:4.6},
    {name:'Prof. Yusupova M.',dept:'Matematika',subjects:['Matematika (AI)','Algoritmlar'],groups:['AI-2301','DB-2301'],hours:16,rating:4.4},
    {name:'Prof. Rahimova N.',dept:'Ingliz tili',subjects:['Ingliz tili (Tech)'],groups:['AI-2301','CS-2301','IT-2301'],hours:18,rating:4.7},
    {name:'Prof. Toshmatov A.',dept:'Computer Vision',subjects:['Computer Vision','NLP'],groups:['AI-2301'],hours:10,rating:4.2},
  ];
  var bgPalette=['#1B4FD8','#7C3AED','#16A34A','#EA580C','#0D9488'];
  // Performance list
  var sorted=[...teachers].sort(function(a,b){return b.rating-a.rating;});
  tList.innerHTML=sorted.map(function(t,i){
    var ini=t.name.replace('Prof. ','').split(' ').map(function(x){return x[0];}).join('');
    var pct=Math.round((t.rating/5)*100);
    var bg=bgPalette[i%bgPalette.length];
    var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
    return '<div class="teacher-perf-row">'
      +'<div class="tpr-avatar" style="background:'+bg+'">'+ini+'</div>'
      +'<div style="flex:1">'
        +'<div class="tpr-name">'+medal+' '+t.name+'</div>'
        +'<div class="tpr-dept">'+t.dept+' · '+t.subjects.length+' ta fan</div>'
        +'<div class="tpr-bar-wrap" style="margin-top:5px">'
          +'<div class="tpr-bar-fill" style="width:'+pct+'%;background:'+bg+'"></div>'
        +'</div>'
      +'</div>'
      +'<div style="text-align:right">'
        +'<div class="tpr-score" style="color:'+bg+'">'+t.rating.toFixed(1)+'</div>'
        +'<div style="font-size:9.5px;color:#94A3B8;margin-top:2px">/ 5.0</div>'
      +'</div>'
    +'</div>';
  }).join('');
  // Load chart
  var maxH=Math.max.apply(null,teachers.map(function(t){return t.hours;}));
  tLoad.innerHTML='<div style="display:flex;align-items:flex-end;gap:8px;height:110px;padding:0 4px">'
    +teachers.map(function(t,i){
      var h=Math.round((t.hours/maxH)*85);
      var bg=bgPalette[i%bgPalette.length];
      var ini=t.name.replace('Prof. ','').split(' ').map(function(x){return x[0];}).join('');
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">'
        +'<span style="font-size:10px;font-weight:700;font-family:\'DM Mono\',monospace;color:'+bg+'">'+t.hours+'s</span>'
        +'<div style="width:100%;background:'+bg+';opacity:0.82;border-radius:5px 5px 0 0;height:'+h+'px"></div>'
        +'<div style="font-size:9.5px;color:#94A3B8;text-align:center;line-height:1.2">'+ini+'</div>'
      +'</div>';
    }).join('')
  +'</div><div style="font-size:10px;color:#94A3B8;text-align:center;margin-top:6px">Haftalik dars soati (soat)</div>';
  // Detail table
  tBody.innerHTML=teachers.map(function(t,i){
    var bg=bgPalette[i%bgPalette.length];
    var ini=t.name.replace('Prof. ','').split(' ').map(function(x){return x[0];}).join('');
    var aloP=Math.round(30+t.rating*8+Math.random()*10);
    var baseAvg=(60+t.rating*6).toFixed(1);
    return '<tr>'
      +'<td>'+(i+1)+'</td>'
      +'<td><div style="display:flex;align-items:center;gap:9px">'
        +'<div style="background:'+bg+';width:32px;height:32px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff">'+ini+'</div>'
        +'<span style="font-weight:600">'+t.name+'</span>'
      +'</div></td>'
      +'<td>'+t.dept+'</td>'
      +'<td style="text-align:center">'+t.subjects.length+'</td>'
      +'<td>'+t.groups.join(', ')+'</td>'
      +'<td style="text-align:center;font-family:\'DM Mono\',monospace;font-weight:700;color:#1B4FD8">'+baseAvg+'</td>'
      +'<td style="text-align:center;color:#16A34A;font-weight:700">'+aloP+'%</td>'
      +'<td><span style="display:flex;align-items:center;gap:3px;font-weight:700;color:#D97706">⭐ '+t.rating.toFixed(1)+'</span></td>'
    +'</tr>';
  }).join('');
}

function renderRiskStudents(){
  var highEl=document.getElementById('riskHighList');
  var midEl=document.getElementById('riskMidList');
  var attEl=document.getElementById('attendRiskBody');
  if(!highEl||!midEl) return;
  var allStudents=STUDENTS_DATA.length?STUDENTS_DATA:[
    {id:1,name:'Bobur Tursunov',group:'AI-2301',course:2,gpa:1.8,avg:51,att:72},
    {id:2,name:'Kamola Mirzayeva',group:'CS-2301',course:2,gpa:2.1,avg:58,att:68},
    {id:3,name:'Jasur Rahmatov',group:'IT-2301',course:1,gpa:1.6,avg:44,att:61},
    {id:4,name:'Gulnora Tosheva',group:'DB-2301',course:3,gpa:2.4,avg:63,att:74},
    {id:5,name:'Nodir Hamidov',group:'AI-2301',course:2,gpa:2.2,avg:61,att:71},
  ];
  var high=allStudents.filter(function(s){return s.avg<56;});
  var mid=allStudents.filter(function(s){return s.avg>=56&&s.avg<66;});
  var badAtt=allStudents.filter(function(s){return s.att<80;});
  var hBadge=document.getElementById('highRiskBadge');
  var mBadge=document.getElementById('midRiskBadge');
  if(hBadge) hBadge.textContent=high.length+' ta';
  if(mBadge) mBadge.textContent=mid.length+' ta';
  function riskRow(s,type){
    return '<div class="risk-student-row '+(type==='high'?'risk-high':'risk-mid')+'">'
      +'<div style="width:34px;height:34px;border-radius:9px;background:'+(type==='high'?'#DC2626':'#D97706')+';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0">'
        +s.name.split(' ').map(function(x){return x[0];}).join('')
      +'</div>'
      +'<div style="flex:1">'
        +'<div class="rsr-name">'+s.name+'</div>'
        +'<div class="rsr-info">'+s.group+' · '+s.course+'-kurs · GPA: '+s.gpa+'</div>'
      +'</div>'
      +'<div style="text-align:right">'
        +'<div style="font-size:18px;font-weight:900;font-family:\'DM Mono\',monospace;color:'+(type==='high'?'#DC2626':'#D97706')+'">'+s.avg+'</div>'
        +'<span class="rsr-badge '+(type==='high'?'rsr-badge-red':'rsr-badge-yellow')+'">'+(type==='high'?'Kritik':'Diqqat')+'</span>'
      +'</div>'
    +'</div>';
  }
  highEl.innerHTML=high.length?high.map(function(s){return riskRow(s,'high');}).join('')
    :'<div style="text-align:center;padding:24px;color:#16A34A;font-size:13px">✅ Yuqori xavf guruhida hech kim yo\'q</div>';
  midEl.innerHTML=mid.length?mid.map(function(s){return riskRow(s,'mid');}).join('')
    :'<div style="text-align:center;padding:24px;color:#1B4FD8;font-size:13px">✅ O\'rta xavf guruhida hech kim yo\'q</div>';
  if(attEl){
    attEl.innerHTML=badAtt.length?badAtt.map(function(s){
      var color=s.att<70?'#DC2626':'#D97706';
      var sabsiz=Math.max(0,Math.round((100-s.att)/2));
      return '<tr>'
        +'<td><div style="display:flex;align-items:center;gap:8px"><div style="background:#94A3B8;width:26px;height:26px;min-width:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:700">'+s.name.split(' ').map(function(x){return x[0];}).join('')+'</div>'+s.name+'</div></td>'
        +'<td>'+s.group+'</td>'
        +'<td><span style="font-weight:800;color:'+color+';font-family:\'DM Mono\',monospace">'+s.att+'%</span></td>'
        +'<td style="color:#DC2626;font-weight:700">'+sabsiz+' dars</td>'
        +'<td><span class="status-tag '+(s.att<70?'st-warning':'st-neutral')+'">'+( s.att<70?'Ogohlantirildi':'Nazoratda')+'</span></td>'
      +'</tr>';
    }).join('')
    :'<tr><td colspan="5" style="text-align:center;padding:20px;color:#16A34A">✅ Davomat muammosi yo\'q</td></tr>';
  }
}

function renderSemesterCompare(){
  var bodyEl=document.getElementById('semCmpBody');
  var chartEl=document.getElementById('subjectCmpChart');
  if(!bodyEl) return;
  var cmpData=[
    {grp:'AI-2301',avg1:78.4,avg2:83.1,pass1:84,pass2:89},
    {grp:'CS-2301',avg1:75.2,avg2:80.7,pass1:81,pass2:86},
    {grp:'IT-2301',avg1:71.8,avg2:74.9,pass1:78,pass2:82},
    {grp:'DB-2301',avg1:70.1,avg2:73.5,pass1:75,pass2:79},
  ];
  bodyEl.innerHTML=cmpData.map(function(d){
    var deltaAvg=(d.avg2-d.avg1).toFixed(1);
    var deltaPass=d.pass2-d.pass1;
    var upAvg=parseFloat(deltaAvg)>0;
    var upPass=deltaPass>0;
    return '<tr>'
      +'<td style="font-weight:700">'+d.grp+'</td>'
      +'<td style="font-family:\'DM Mono\',monospace;font-weight:600;text-align:center">'+d.avg1+'</td>'
      +'<td style="font-family:\'DM Mono\',monospace;font-weight:700;text-align:center;color:#1B4FD8">'+d.avg2+'</td>'
      +'<td style="text-align:center" class="'+(upAvg?'delta-up':'delta-dn')+'">'+( upAvg?'↑ +':' ↓ ')+Math.abs(deltaAvg)+'</td>'
      +'<td style="font-family:\'DM Mono\',monospace;text-align:center">'+d.pass1+'%</td>'
      +'<td style="font-family:\'DM Mono\',monospace;text-align:center;font-weight:700;color:#1B4FD8">'+d.pass2+'%</td>'
      +'<td style="text-align:center" class="'+(upPass?'delta-up':'delta-dn')+'">'+( upPass?'↑ +':' ↓ ')+Math.abs(deltaPass)+'%</td>'
    +'</tr>';
  }).join('');
  if(!chartEl) return;
  var subCmp=[
    {sub:'Machine Learning',s1:74,s2:81},{sub:'Python for AI',s1:79,s2:84},
    {sub:'Deep Learning',s1:68,s2:76},{sub:'Data Science',s1:72,s2:78},
    {sub:'Matematika',s1:66,s2:71},{sub:'Ingliz tili',s1:80,s2:85},
  ];
  chartEl.innerHTML='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">'
    +'<thead><tr>'
      +'<th style="text-align:left;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">Fan</th>'
      +'<th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">I semestr</th>'
      +'<th style="text-align:center;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">II semestr</th>'
      +'<th style="text-align:left;padding:8px 12px;border-bottom:1.5px solid #E2E8F0;font-size:11px;font-weight:700;color:#94A3B8;text-transform:uppercase">O\'zgarish</th>'
    +'</tr></thead>'
    +'<tbody>'
    +subCmp.map(function(r){
      var delta=r.s2-r.s1;
      var up=delta>0;
      var barColor=up?'#16A34A':'#DC2626';
      return '<tr>'
        +'<td style="padding:9px 12px;border-bottom:1px solid #F8FAFC;font-weight:600">'+r.sub+'</td>'
        +'<td style="padding:9px 12px;border-bottom:1px solid #F8FAFC;text-align:center;font-family:\'DM Mono\',monospace;color:#64748B">'+r.s1+'</td>'
        +'<td style="padding:9px 12px;border-bottom:1px solid #F8FAFC;text-align:center;font-family:\'DM Mono\',monospace;font-weight:800;color:#1B4FD8">'+r.s2+'</td>'
        +'<td style="padding:9px 12px;border-bottom:1px solid #F8FAFC">'
          +'<div style="display:flex;align-items:center;gap:8px">'
            +'<span style="font-weight:700;color:'+barColor+'">'+(up?'↑ +':' ↓ ')+Math.abs(delta)+'</span>'
            +'<div style="flex:1;height:5px;background:#F1F5F9;border-radius:3px;overflow:hidden;max-width:80px">'
              +'<div style="height:100%;background:'+barColor+';border-radius:3px;width:'+Math.min(Math.abs(delta)*12,100)+'%"></div>'
            +'</div>'
          +'</div>'
        +'</td>'
      +'</tr>';
    }).join('')
    +'</tbody></table></div>';
}

function exportReportCSV(){
  var groups=['AI-2301','CS-2301','IT-2301','DB-2301'];
  var csv='Guruh,Talabalar soni,Ort. ball,A\'lo (86+),Yaxshi (71-85),Qoniqarsiz (<56),GPA\n';
  groups.forEach(function(grp){
    var ss=STUDENTS_DATA.filter(function(s){return s.group===grp;});
    if(!ss.length) return;
    var avgs=ss.map(function(s){
      return GRADES_DATA.reduce(function(acc,g){
        var key=s.id+'_'+g.sub;var sv=SAVED_GRADES[key];
        return acc+(sv?sv.jn:g.jn)+(sv?sv.on:g.on)+(sv?sv.yn:g.yn)+(sv?sv.mi:g.mi);
      },0)/Math.max(GRADES_DATA.length,1);
    });
    var avg=(avgs.reduce(function(a,b){return a+b;},0)/avgs.length).toFixed(1);
    var alo=avgs.filter(function(a){return a>=86;}).length;
    var yax=avgs.filter(function(a){return a>=71&&a<86;}).length;
    var fail=avgs.filter(function(a){return a<56;}).length;
    var gpaAvg=(ss.reduce(function(a,s){return a+(parseFloat(s.gpa)||3);},0)/ss.length).toFixed(2);
    csv+='"'+grp+'",'+ss.length+','+avg+','+alo+','+yax+','+fail+','+gpaAvg+'\n';
  });
  var blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='IDU_hisobot_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  showToast('📊','CSV export','Hisobot fayli yuklab olindi');
}

function printReport(){
  window.print();
  showToast('🖨️','Chop etish','Chop etish oynasi ochildi');
}
function openStudentDetail(id){
  const s=STUDENTS_DATA.find(x=>x.id===id);if(!s)return;
  document.getElementById('studentDetailTitle').textContent=s.name;
  document.getElementById('studentDetailContent').innerHTML=`
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
      <div style="width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,var(--primary),#3B82F6);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:white">${s.name.split(' ').map(x=>x[0]).join('')}</div>
      <div>
        <div style="font-size:20px;font-weight:800">${s.name}</div>
        <div style="color:var(--text2);margin-top:4px">${s.group} · ${s.course}-kurs</div>
      </div>
    </div>
    <div class="stats-grid-3" style="margin-bottom:16px">
      <div style="text-align:center;padding:14px;background:var(--bg);border-radius:var(--r2)">
        <div style="font-size:24px;font-weight:900;color:var(--primary);font-family:'DM Mono',monospace">${s.gpa}</div>
        <div style="font-size:12px;color:var(--text3)">GPA</div>
      </div>
      <div style="text-align:center;padding:14px;background:var(--bg);border-radius:var(--r2)">
        <div style="font-size:24px;font-weight:900;color:var(--green);font-family:'DM Mono',monospace">${s.avg}</div>
        <div style="font-size:12px;color:var(--text3)">O'rt. ball</div>
      </div>
      <div style="text-align:center;padding:14px;background:var(--bg);border-radius:var(--r2)">
        <div style="font-size:24px;font-weight:900;color:${s.att>=90?'var(--green)':'var(--orange)'};font-family:'DM Mono',monospace">${s.att}%</div>
        <div style="font-size:12px;color:var(--text3)">Davomat</div>
      </div>
    </div>
    <table class="grade-table"><thead><tr><th>Fan</th><th>JN</th><th>ON</th><th>YN</th><th>MI</th><th>Jami</th><th>Baho</th></tr></thead>
    <tbody>${GRADES_DATA.map(g=>{const t=g.jn+g.on+g.yn+g.mi;const{letter,cls}=getGrade(t);return`<tr><td>${g.sub}</td><td>${g.jn}</td><td>${g.on}</td><td>${g.yn}</td><td>${g.mi}</td><td><strong>${t}</strong></td><td><span class="grade-chip ${cls}">${letter}</span></td></tr>`;}).join('')}</tbody></table>`;
  document.getElementById('studentDetailModal').classList.add('open');
}

// ════════════════════════════════════
//  STARTUP IDEAS
// ════════════════════════════════════
function renderIdeas(filter='all'){
  const el=document.getElementById('ideasList');if(!el)return;
  const catColors={tech:'cat-tech',health:'cat-health',edu:'cat-edu',fintech:'cat-fintech',social:'cat-social'};
  const catNames={tech:'💻 Texnologiya',health:'🏥 Sog\'liqni saqlash',edu:'📚 Ta\'lim',fintech:'💰 Fintech',social:'🌍 Ijtimoiy'};
  const filtered=filter==='all'?IDEAS:IDEAS.filter(i=>i.category===filter);
  el.innerHTML=filtered.map(idea=>`
    <div class="idea-card" id="idea-${idea.id}">
      <div class="idea-header">
        <div>
          <span class="idea-category ${catColors[idea.category]||'cat-tech'}">${catNames[idea.category]||idea.category}</span>
          <div class="idea-title">${idea.title}</div>
        </div>
        ${currentRole==='investor'?`<div class="investor-badge">💼 Investor ko'rinishi</div>`:''}
      </div>
      <div class="idea-desc">${idea.desc}</div>
      ${idea.investment?`<div style="font-size:13px;color:var(--text2);margin-bottom:10px">💰 Kerakli investitsiya: <strong>${idea.investment}</strong></div>`:''}
      <div class="idea-team">
        ${idea.team.map((m,i)=>{const cs=['#1B4FD8','#16A34A','#7C3AED','#EA580C'];return`<div class="team-member"><div class="tm-avatar" style="background:${cs[i%4]}">${m.split(' ').map(x=>x[0]).join('')}</div>${m}</div>`;}).join('')}
      </div>
      <div class="idea-footer">
        <div class="idea-stats">
          <div class="idea-stat" onclick="likeIdea(${idea.id})">❤️ ${idea.likes}</div>
          <div class="idea-stat">💬 ${idea.comments.length}</div>
          ${currentRole==='investor'||currentRole==='dekanat'?`
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12px;color:var(--text2)">Baho:</span>
            <div class="star-rating" id="stars-${idea.id}">
              ${[1,2,3,4,5].map(n=>`<span class="star${n<=idea.investorRating?' filled':''}" onclick="rateIdea(${idea.id},${n})">★</span>`).join('')}
            </div>
          </div>`:''}
        </div>
        ${currentRole==='investor'?`<button class="invest-btn" onclick="expressInterest(${idea.id})">💼 Qiziqish bildirish</button>`:''}
      </div>
      <div class="idea-comments">
        <div style="font-size:13px;font-weight:700;margin-bottom:10px">Izohlar (${idea.comments.length})</div>
        ${idea.comments.map(c=>`
          <div class="comment-item">
            <div class="comment-avatar" style="background:#7C3AED">${c.author[0]}</div>
            <div class="comment-body">
              <div class="comment-author">${c.author}</div>
              <div class="comment-text">${c.text}</div>
              <div class="comment-time">${c.time}</div>
            </div>
          </div>`).join('')}
        <div class="add-comment-row">
          <input class="comment-input" placeholder="Izoh yozing..." id="comment-input-${idea.id}"
            onkeydown="if(event.key==='Enter')addComment(${idea.id})">
          <button class="comment-send" onclick="addComment(${idea.id})">Yuborish</button>
        </div>
      </div>
    </div>`).join('');
}
function filterIdeas(f,el){
  document.querySelectorAll('#page-startup .filter-chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderIdeas(f);
}
function likeIdea(id){
  const idea=IDEAS.find(i=>i.id===id);if(!idea)return;
  idea.likes++;renderIdeas();showToast('❤️','Like!','Qiziqishingiz belgilandi');
}
function rateIdea(id,stars){
  const idea=IDEAS.find(i=>i.id===id);if(!idea)return;
  idea.investorRating=stars;
  renderIdeas();
  showToast('⭐','Baholandi!',`G'oya ${stars} yulduz bilan baholandi`);
  const ic=document.getElementById('investorRatedCount');if(ic)ic.textContent=parseInt(ic.textContent||'0')+1;
}
function expressInterest(id){
  const idea=IDEAS.find(i=>i.id===id);if(!idea)return;
  showToast('💼','Qiziqish bildirdi!',`${currentUser.company} — "${idea.title}" g'oyasiga qiziqish bildirdi`);
  const ic=document.getElementById('investorInterestedCount');if(ic)ic.textContent=parseInt(ic.textContent||'0')+1;
}
function addComment(id){
  const inp=document.getElementById('comment-input-'+id);if(!inp)return;
  const text=inp.value.trim();if(!text)return;
  const idea=IDEAS.find(i=>i.id===id);if(!idea)return;
  idea.comments.push({author:currentUser?.name||'Foydalanuvchi',text,time:'Hozir'});
  inp.value='';
  renderIdeas();
  showToast('💬','Izoh qo\'shildi','Izohingiz muvaffaqiyatli qo\'shildi');
}
function toggleIdeaForm(){
  ideaFormVisible=!ideaFormVisible;
  const fc=document.getElementById('ideaFormCard');
  if(fc)fc.style.display=ideaFormVisible?'block':'none';
  const btn=document.getElementById('addIdeaBtn');
  if(btn)btn.textContent=ideaFormVisible?'✕ Yopish':'+ G\'oya qo\'shish';
}
function submitIdea(){
  const title=document.getElementById('ideaTitle')?.value.trim();
  const desc=document.getElementById('ideaDesc')?.value.trim();
  const cat=document.getElementById('ideaCategory')?.value;
  const inv=document.getElementById('ideaInvestment')?.value.trim();
  const t1=document.getElementById('tm1')?.value.trim();
  const t2=document.getElementById('tm2')?.value.trim();
  const t3=document.getElementById('tm3')?.value.trim();
  const t4=document.getElementById('tm4')?.value.trim();
  if(!title||!desc){showToast('⚠️','Xato','Sarlavha va tavsif kiritilishi shart!');return;}
  const team=[t1,t2,t3,t4].filter(Boolean);
  if(team.length<2){showToast('⚠️','Xato','Kamida 2 ta jamoa a\'zosi kerak!');return;}
  const newIdea={
    id:Date.now(),title,category:cat,desc,team,
    investment:inv||null,likes:0,stars:0,comments:[],investorRating:0
  };
  IDEAS.unshift(newIdea);
  toggleIdeaForm();
  ['ideaTitle','ideaDesc','ideaInvestment','tm1','tm2','tm3','tm4'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  renderIdeas();
  showToast('🚀','G\'oya yuborildi!','Startup g\'oyangiz muvaffaqiyatli qo\'shildi');
}

// ════════════════════════════════════
//  INVESTOR
// ════════════════════════════════════
function renderInvestorDashboard(){
  const el=document.getElementById('topIdeasList');if(!el)return;
  const top=[...IDEAS].sort((a,b)=>b.investorRating-a.investorRating).slice(0,3);
  el.innerHTML=top.map(idea=>`
    <div style="display:flex;align-items:center;gap:14px;padding:13px 0;border-bottom:1px solid #F8FAFC">
      <div style="font-size:24px">🚀</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">${idea.title}</div>
        <div style="font-size:12px;color:var(--text2)">Jamoa: ${idea.team.slice(0,2).join(', ')}</div>
      </div>
      <div style="display:flex;gap:2px">${[1,2,3,4,5].map(n=>`<span style="color:${n<=idea.investorRating?'#F59E0B':'#E2E8F0'};font-size:16px">★</span>`).join('')}</div>
    </div>`).join('');
  const cn=document.getElementById('investorCompanyName');
  if(cn&&currentUser?.company)cn.textContent=currentUser.company;
}

// ════════════════════════════════════
//  QUIZ
// ════════════════════════════════════
function openQuiz(){quizIdx=0;quizScore=0;renderQuiz();document.getElementById('quizModal').classList.add('open');}
function closeQuiz(){document.getElementById('quizModal').classList.remove('open');}
function renderQuiz(){
  const qEl=document.getElementById('quizContent');if(!qEl)return;
  if(quizIdx>=QUIZ_QUESTIONS.length){
    const pct=Math.round(quizScore/QUIZ_QUESTIONS.length*100);
    qEl.innerHTML=`<div class="quiz-result">
      <div class="quiz-result-pct" style="color:${pct>=80?'var(--green)':pct>=50?'var(--primary)':'var(--red)'}">${pct}%</div>
      <div class="quiz-result-msg">${quizScore}/${QUIZ_QUESTIONS.length} to'g'ri javob<br>${pct>=80?'🎉 A\'lo natija!':pct>=50?'👍 Yaxshi!':'💪 Ko\'proq o\'rganing!'}</div>
      <div class="quiz-result-btns">
        <button class="btn btn-secondary" onclick="closeQuiz()">Yopish</button>
        <button class="btn btn-primary" onclick="openQuiz()">Qayta boshlash</button>
      </div>
    </div>`;
    return;
  }
  const q=QUIZ_QUESTIONS[quizIdx];
  qEl.innerHTML=`
    <div class="quiz-prog-bar"><div class="quiz-prog-fill" style="width:${quizIdx/QUIZ_QUESTIONS.length*100}%"></div></div>
    <div class="quiz-meta-row"><span>${quizIdx+1}/${QUIZ_QUESTIONS.length} savol</span><span id="quizTimer">⏱ 30s</span></div>
    <div class="quiz-question">${q.q}</div>
    <div class="quiz-opts">${q.opts.map((o,i)=>`
      <div class="quiz-opt" onclick="answerQuiz(${i})" id="qopt${i}">
        <div class="opt-ltr">${'ABCD'[i]}</div>${o}
      </div>`).join('')}
    </div>`;
  let t=30;
  clearInterval(window.quizTimerInt);
  window.quizTimerInt=setInterval(()=>{
    t--;
    const te=document.getElementById('quizTimer');
    if(te)te.textContent=`⏱ ${t}s`;
    if(t<=0){clearInterval(window.quizTimerInt);answerQuiz(-1);}
  },1000);
}
function answerQuiz(idx){
  clearInterval(window.quizTimerInt);
  const q=QUIZ_QUESTIONS[quizIdx];
  document.querySelectorAll('.quiz-opt').forEach((el,i)=>{
    el.classList.add('locked');
    if(i===q.ans)el.classList.add('correct');
    else if(i===idx&&idx!==q.ans)el.classList.add('wrong');
  });
  if(idx===q.ans)quizScore++;
  setTimeout(()=>{quizIdx++;renderQuiz();},1000);
}

// ════════════════════════════════════
//  MISC
// ════════════════════════════════════
function syncData(){
  showToast('🔄','Yangilanmoqda...','HEMIS tizimiga ulanildi');
  setTimeout(()=>showToast('✅','Yangilandi!','Barcha ma\'lumotlar joriy'),2000);
}
function showToast(icon,title,msg){
  const tc=document.getElementById('toastContainer');
  const t=document.createElement('div');
  t.className='toast-item';
  t.innerHTML=`<div class="toast-item-icon">${icon}</div>
    <div class="toast-item-body">
      <div class="toast-item-title">${title}</div>
      <div class="toast-item-msg">${msg}</div>
    </div>
    <button class="toast-item-close" onclick="this.parentElement.remove()">✕</button>
    <div class="toast-item-bar"></div>`;
  tc.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),400);},5000);
}

// ════════════════════════════════════
//  AI TUTOR
// ════════════════════════════════════
const AI_RESPONSES = {
  'python':['Python — eng ommabop dasturlash tillaridan biri. Keling, OOP (Ob\'yektga yo\'naltirilgan dasturlash) asoslarini ko\'rib chiqaylik:\n\n**Klass va ob\'yekt:**\n```\nclass Talaba:\n    def __init__(self, ism):\n        self.ism = ism\n    def salomlash(self):\n        return f"Salom, {self.ism}!"\n```\nBu misolda `Talaba` klass, `t = Talaba("Ali")` esa ob\'yekt hisoblanadi.'],
  'algebra':['Algebra asosiy formulalari:\n\n📐 **Kvadrat tenglamalar:** ax² + bx + c = 0\nYechim: x = (-b ± √(b²-4ac)) / 2a\n\n📐 **Faktorlash:** (a+b)² = a² + 2ab + b²\n\n📐 **Logarifm:** log(ab) = log(a) + log(b)'],
  'fizika':['Fizikaning asosiy qonunlari:\n\n⚛️ **Nyuton qonunlari:**\n- 1-qonun: Tana harakatini o\'zgartirish uchun kuch kerak\n- 2-qonun: F = ma (kuch = massa × tezlanish)\n- 3-qonun: Har bir ta\'sirga teng qarama-qarshi ta\'sir bor'],
  'default':['Savolingizni tushundim! Keling, batafsil ko\'rib chiqaylik. Qaysi fandan yordam kerak — Matematika, Dasturlash, Fizika yoki Ingliz tili? Men har birida sizga yordam bera olaman! 📚','Bu mavzu juda qiziqarli. Avval asosiy tushunchalardan boshlaylik, keyin murakkab misollarga o\'tamiz. Tayyor bo\'lsangiz, "davom et" deb yozing! 💡']
};
function sendAIMsg(){
  const inp=document.getElementById('aiInput');
  const txt=inp?.value.trim();if(!txt)return;
  inp.value='';
  appendMsg('user',txt);
  document.getElementById('aiSendBtn').disabled=true;
  setTimeout(()=>{
    const key=Object.keys(AI_RESPONSES).find(k=>txt.toLowerCase().includes(k))||'default';
    const res=AI_RESPONSES[key];
    const reply=res[Math.floor(Math.random()*res.length)];
    appendMsg('ai',reply);
    document.getElementById('aiSendBtn').disabled=false;
  },800);
}
function askAI(q){document.getElementById('aiInput').value=q;sendAIMsg();}
function appendMsg(role,text){
  const mc=document.getElementById('aiMessages');if(!mc)return;
  const now=new Date().toLocaleTimeString('uz-UZ',{hour:'2-digit',minute:'2-digit'});
  const d=document.createElement('div');
  d.className=`chat-bubble-wrap ${role}`;
  d.innerHTML=`<div class="bubble-avatar ba-${role}">${role==='ai'?'🤖':(currentUser?.name||'?').split(' ').map(x=>x[0]).join('').slice(0,2)}</div>
    <div class="bubble-body"><div class="bubble">${text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</div>
    <div class="bubble-time">${now}</div></div>`;
  mc.appendChild(d);
  mc.scrollTop=mc.scrollHeight;
}

// ════════════════════════════════════
//  INIT
// ════════════════════════════════════
window.addEventListener('load',()=>{
  var _bn=document.getElementById('btnNext'); if(_bn) _bn.disabled=true;
});
// ════════════════════════════════════
//  GAMIFICATION STATE
// ════════════════════════════════════
let playerXP = 0, playerLevel = 1, playerCoins = 0, gamesPlayed = 0;
let streakDays = parseInt(localStorage.getItem('idu_streak')||'0');
let streakRecord = parseInt(localStorage.getItem('idu_streak_record')||'0');
let pomoSessions = 0, pomoTodaySessions = 0;
let pomoRunning = false, pomoInterval = null;
let pomoDuration = 25*60, pomoRemaining = 25*60;
let gameActive = false, gameTimerInt = null;
let currentGame = '', gameScore = 0, gameStreak = 0, gameQNum = 0;
let warnCount = 0, maxWarnings = 3;
let anticheatActive = false;
const XP_PER_LEVEL = 100;
const LEVEL_NAMES = ['Yangi boshlovchi','Izlovchi','O\'rganuvchi','Faol talaba','Mohir talaba','Ekspert','Master','Grandmaster','Chempion','IDU Ustasi'];

// ════════════════════════════════════
//  NEW NAV ITEMS (extend existing)
// ════════════════════════════════════
const NAV_EXTRA = {
  student: [
    {id:'idu-premium',icon:'🤝',label:'Hamkorlar',labelRu:'Партнёры'},
  ],
  teacher: [{id:'idu-premium',icon:'💰',label:'IDU Premium',labelRu:'IDU Premium'}],
  dekanat: [{id:'idu-premium',icon:'💰',label:'Daromad',labelRu:'Доход'}],
  investor: [{id:'idu-premium',icon:'📈',label:'Statistika',labelRu:'Статистика'}],
};

// Navigation functions are integrated directly — no override needed

// ════════════════════════════════════
//  XP / COINS / LEVEL
// ════════════════════════════════════
function addXP(amount, reason){
  playerXP += amount;
  const newLevel = Math.floor(playerXP / XP_PER_LEVEL) + 1;
  if(newLevel > playerLevel){
    playerLevel = newLevel;
    showToast('⚡','Daraja oshdi!',`Siz ${playerLevel}-darajaga ko'tarildingiz! 🎉`);
  }
  updateXPDisplays();
  if(reason) showToast('✨','XP qo\'shildi',`+${amount} XP — ${reason}`);
}
function addCoins(amount, reason){
  playerCoins += amount;
  updateXPDisplays();
  if(reason) showToast('🪙','Coin qo\'shildi',`+${amount} IDU Coin — ${reason}`);
}
function updateXPDisplays(){
  const xpInLevel = playerXP % XP_PER_LEVEL;
  const pct = (xpInLevel / XP_PER_LEVEL) * 100;
  const ln = LEVEL_NAMES[Math.min(playerLevel-1, LEVEL_NAMES.length-1)];
  // Sidebar
  const sl=document.getElementById('sidebarLevel');if(sl)sl.textContent=playerLevel;
  const sln=document.getElementById('sidebarLevelName');if(sln)sln.textContent=ln;
  const sxp=document.getElementById('sidebarXPBar');if(sxp)sxp.style.width=pct+'%';
  const sxpt=document.getElementById('sidebarXP');if(sxpt)sxpt.textContent=playerXP+' XP';
  const sc=document.getElementById('sidebarCoins');if(sc)sc.textContent='🪙 '+playerCoins;
  // Game hub
  const gcd=document.getElementById('gameCoinsDisplay');if(gcd)gcd.textContent='🪙 '+playerCoins;
  const gld=document.getElementById('gameLevelDisplay');if(gld)gld.textContent='⚡ Daraja '+playerLevel;
  // Gamification page
  const tcd=document.getElementById('totalCoinsDisplay');if(tcd)tcd.textContent='🪙 '+playerCoins+' IDU Coin';
  const tld=document.getElementById('totalLevelDisplay');if(tld)tld.textContent='⚡ Daraja '+playerLevel;
  const blb=document.getElementById('bigLevelBadge');if(blb)blb.textContent=playerLevel;
  const xbf=document.getElementById('xpBarFill');if(xbf)xbf.style.width=pct+'%';
  const cxp=document.getElementById('currentXP');if(cxp)cxp.textContent=playerXP+' XP';
  const mxp=document.getElementById('maxXP');if(mxp)mxp.textContent=(Math.ceil(playerXP/XP_PER_LEVEL)*XP_PER_LEVEL)+' XP';
  const xtn=document.getElementById('xpToNext');if(xtn)xtn.textContent=XP_PER_LEVEL-xpInLevel;
  const txps=document.getElementById('totalXPStat');if(txps)txps.textContent=playerXP;
  const tcs=document.getElementById('totalCoinsStat');if(tcs)tcs.textContent=playerCoins;
  const gps=document.getElementById('gamesPlayedStat');if(gps)gps.textContent=gamesPlayed;
}

// ════════════════════════════════════
//  ANTI-CHEAT SYSTEM
// ════════════════════════════════════
function initAntiCheat(){
  // Tab visibility detection
  document.addEventListener('visibilitychange',()=>{
    if(anticheatActive && document.hidden){
      triggerWarning('⚠️ Siz testdan CHIQIB KETDINGIZ! Tab almashtirish qayd etildi!');
    }
  });
  // Right-click disable during game/test
  document.addEventListener('contextmenu',(e)=>{
    if(anticheatActive){e.preventDefault();triggerWarning('🚫 Test vaqtida o\'ng tugma ishlamaydi!');}
  });
  // Copy-paste disable
  document.addEventListener('copy',(e)=>{
    if(anticheatActive){e.preventDefault();showToast('🚫','Bloklandi','Test vaqtida nusxa olish mumkin emas!');}
  });
  document.addEventListener('keydown',(e)=>{
    if(!anticheatActive)return;
    // Block F12, Ctrl+Shift+I, Ctrl+U, Ctrl+C
    if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&e.key==='I')||(e.ctrlKey&&e.key==='u')){
      e.preventDefault();
      triggerWarning('🔒 DevTools ochish taqiqlangan! Bu harakat qayd etildi.');
    }
  });
  // DevTools size detection
  setInterval(()=>{
    if(anticheatActive){
      const threshold=160;
      if(window.outerWidth-window.innerWidth>threshold||window.outerHeight-window.innerHeight>threshold){
        triggerWarning('🔍 DevTools ochiganligini aniqladik! Faoliyatingiz qayd etildi.');
      }
    }
  },2000);
}

function triggerWarning(msg){
  warnCount++;
  const overlay=document.getElementById('anticheatOverlay');
  const msgEl=document.getElementById('anticheatMsg');
  if(msgEl)msgEl.textContent=msg+` (${warnCount}/${maxWarnings} ogohlantirish)`;
  // Update warn dots
  const wc=document.getElementById('warnCounter');
  if(wc){
    wc.innerHTML=[1,2,3].map(i=>`<div class="warn-dot${i<=warnCount?' active':''}"></div>`).join('');
  }
  if(overlay)overlay.classList.add('show');
  if(warnCount>=maxWarnings){
    setTimeout(()=>{
      forceSubmitGame();
      overlay.classList.remove('show');
      showToast('🚨','Test yakunlandi!','3 ta ogohlantirish — test avtomatik topshirildi. Dekanatga xabar yuborildi.');
    },3000);
  }
}
function dismissWarning(){
  document.getElementById('anticheatOverlay')?.classList.remove('show');
}
function forceSubmitGame(){
  if(gameActive) finishGame(true);
}
initAntiCheat();

// ════════════════════════════════════
//  GAME ENGINE
// ════════════════════════════════════
const GAME_CONFIGS = {
  math:   {title:'🔢 Matematika챔피온', time:60, coins:50,  xp:80,  questions:10},
  prog:   {title:'💻 Kod to\'ldirish',  time:90, coins:70,  xp:100, questions:8},
  english:{title:'🌍 So\'z juftlash',   time:45, coins:40,  xp:60,  questions:1},
  physics:{title:'⚛️ Formula izlash',   time:60, coins:60,  xp:90,  questions:8},
  algo:   {title:'📊 Tartiblash o\'yini',time:30, coins:80,  xp:120, questions:5},
  logic:  {title:'🧩 Mantiq masalasi',  time:120,coins:90,  xp:130, questions:6},
};

const MATH_QUESTIONS = [
  {expr:'12 × 8 = ?',   answer:96,  opts:[84,96,98,104]},
  {expr:'√144 = ?',     answer:12,  opts:[11,12,13,14]},
  {expr:'15² = ?',      answer:225, opts:[200,215,225,230]},
  {expr:'2⁸ = ?',       answer:256, opts:[128,256,512,264]},
  {expr:'∫x dx = ?',    answer:'x²/2',opts:['x²','x²/2','2x','x/2']},
  {expr:'log₂(64) = ?', answer:6,   opts:[4,5,6,8]},
  {expr:'3! + 2! = ?',  answer:8,   opts:[6,7,8,10]},
  {expr:'sin(90°) = ?', answer:1,   opts:['0','1','√2/2','√3/2']},
  {expr:'GCD(48, 18) = ?',answer:6, opts:[3,6,9,12]},
  {expr:'47 + 58 = ?',  answer:105, opts:[95,105,115,100]},
];

const CODE_QUESTIONS = [
  {
    code:`<span class="kw-purple">def</span> <span class="kw-blue">factorial</span>(n):\n    <span class="kw-purple">if</span> n <span class="kw-blue">==</span> ___:\n        <span class="kw-purple">return</span> <span class="kw-green">1</span>\n    <span class="kw-purple">return</span> n <span class="kw-blue">*</span> factorial(n <span class="kw-blue">-</span> <span class="kw-green">1</span>)`,
    blank:'0',opts:['0','1','n','None'],answer:'0',
    hint:'Rekursiya asosi: 0! = 1'
  },
  {
    code:`<span class="kw-purple">for</span> i <span class="kw-purple">in</span> <span class="kw-blue">range</span>(<span class="kw-orange">___</span>):\n    <span class="kw-blue">print</span>(i)`,
    blank:'10',opts:['5','10','range(10)','len()'],answer:'10',
    hint:'0 dan 9 gacha chiqarish uchun range(10)'
  },
  {
    code:`my_list = [<span class="kw-green">3</span>, <span class="kw-green">1</span>, <span class="kw-green">4</span>, <span class="kw-green">1</span>, <span class="kw-green">5</span>]\nmy_list.<span class="kw-orange">___</span>()`,
    blank:'sort',opts:['sort','order','arrange','sorted'],answer:'sort',
    hint:'Ro\'yxatni joyida tartiblash metodi'
  },
  {
    code:`<span class="kw-purple">class</span> <span class="kw-blue">Animal</span>:\n    <span class="kw-purple">def</span> <span class="kw-blue">__init__</span>(<span class="kw-orange">___</span>, name):\n        self.name = name`,
    blank:'self',opts:['self','this','cls','obj'],answer:'self',
    hint:'Python klasslarida birinchi parametr'
  },
  {
    code:`numbers = [<span class="kw-green">1</span>,<span class="kw-green">2</span>,<span class="kw-green">3</span>,<span class="kw-green">4</span>,<span class="kw-green">5</span>]\nresult = ___(<span class="kw-purple">lambda</span> x: x%<span class="kw-green">2</span>==<span class="kw-green">0</span>, numbers)`,
    blank:'filter',opts:['filter','map','reduce','list'],answer:'filter',
    hint:'Shartga mos elementlarni filtrlovchi funksiya'
  },
  {
    code:`d = {<span class="kw-red">"a"</span>: <span class="kw-green">1</span>, <span class="kw-red">"b"</span>: <span class="kw-green">2</span>}\nkeys = list(d.___())`,
    blank:'keys',opts:['keys','values','items','get'],answer:'keys',
    hint:'Lug\'atning kalitlarini olish'
  },
  {
    code:`<span class="kw-purple">try</span>:\n    x = <span class="kw-green">1</span> / <span class="kw-green">0</span>\n<span class="kw-orange">___</span> ZeroDivisionError:\n    <span class="kw-blue">print</span>(<span class="kw-red">"Xato!"</span>)`,
    blank:'except',opts:['except','catch','error','handle'],answer:'except',
    hint:'Python da xatolarni ushlash kalit so\'zi'
  },
  {
    code:`import ___\nnum = math.sqrt(<span class="kw-green">16</span>)`,
    blank:'math',opts:['math','cmath','numpy','calc'],answer:'math',
    hint:'Python ning matematik modul nomi'
  },
];

const ENGLISH_PAIRS = [
  ['Algorithm','Algoritm'],['Variable','O\'zgaruvchi'],['Function','Funksiya'],
  ['Database','Ma\'lumotlar bazasi'],['Network','Tarmoq'],['Security','Xavfsizlik'],
  ['Interface','Interfeys'],['Software','Dasturiy ta\'minot'],['Hardware','Apparat ta\'minot'],
  ['Compiler','Kompilyator'],['Debugger','Disk\'yuger'],['Framework','Freymvork'],
];

const PHYSICS_FORMULAS = [
  {expr:'F = ma',      name:'Nyuton 2-qonuni'},
  {expr:'E = mc²',     name:'Ekvivalentlik (Einstein)'},
  {expr:'V = IR',      name:'Om qonuni'},
  {expr:'P = mv',      name:'Impuls'},
  {expr:'W = Fd',      name:'Ish'},
  {expr:'KE = ½mv²',   name:'Kinetik energiya'},
  {expr:'λf = v',      name:'To\'lqin tenglamasi'},
  {expr:'PV = nRT',    name:'Ideal gaz qonuni'},
];

const LOGIC_QUESTIONS = [
  {q:'Bir qutida 3 ta qizil, 5 ta ko\'k shar bor. 2 ta shar tasodifiy olinsa, ikkalasi ham qizil bo\'lish ehtimoli qancha?', opts:['1/28','3/28','6/28','1/8'], ans:1},
  {q:'ABCDE harflaridan nechta 3 harfli kombinatsiya tuzish mumkin (takrorsiz)?', opts:['60','120','20','30'], ans:0},
  {q:'Agar barcha mushuklar hayvon bo\'lsa, va ba\'zi hayvonlar uy bilan yashasa, demak...', opts:['Ba\'zi mushuklar uy bilan yashaydi','Barcha mushuklar uy bilan yashaydi','Uy bilan yashaydigan hech narsa mushuk emas','Hech qaysi mushuk uy bilan yashamaydi'], ans:0},
  {q:'1, 1, 2, 3, 5, 8, 13, ... Keyingi son qaysi?', opts:['18','20','21','22'], ans:2},
  {q:'Agar n juft son bo\'lsa, n² ham juft bo\'ladi. 36 juft son. Demak...', opts:['36² juft','36 toq','36 juft emas','Hech narsa aniq emas'], ans:0},
  {q:'3 ta quti bor: A(2 olma), B(2 apelsin), C(1 olma+1 apelsin). Barchasiga noto\'g\'ri yorliq yopishtirilgan. A qutidan bitta olinsa — olma. A qutidagi nima?', opts:['2 olma','2 apelsin','1 olma+1 apelsin','Noma\'lum'], ans:0},
];

let currentGameData = {};

function startGame(type){
  currentGame = type;
  gameScore = 0; gameStreak = 0; gameQNum = 0;
  anticheatActive = true; warnCount = 0;
  const cfg = GAME_CONFIGS[type];
  document.getElementById('gameArena').style.display = 'block';
  document.getElementById('gameArena').scrollIntoView({behavior:'smooth'});
  document.getElementById('gameTitle').textContent = cfg.title;
  updateGameHeader(cfg.time);
  startGameTimer(cfg.time);
  gamesPlayed++;
  if(type==='math') renderMathQ();
  else if(type==='prog') renderProgQ();
  else if(type==='english') renderEnglishGame();
  else if(type==='physics') renderPhysicsGame();
  else if(type==='algo') renderAlgoGame();
  else if(type==='logic') renderLogicQ();
}
function exitGame(){
  clearInterval(gameTimerInt);
  anticheatActive = false;
  document.getElementById('gameArena').style.display = 'none';
  gameActive = false;
}
function startGameTimer(seconds){
  let t = seconds;
  clearInterval(gameTimerInt);
  gameActive = true;
  gameTimerInt = setInterval(()=>{
    t--;
    const el = document.getElementById('gameTimer');
    if(el){
      el.textContent = t;
      if(t<=10) el.classList.add('warn');
      else el.classList.remove('warn');
    }
    if(t<=0){clearInterval(gameTimerInt);finishGame(false);}
  },1000);
}
function updateGameHeader(maxT){
  const qs = document.getElementById('gameQ');
  const ss = document.getElementById('gameScore');
  const st = document.getElementById('gameStreak2');
  const cfg = GAME_CONFIGS[currentGame];
  if(qs) qs.textContent = `${gameQNum}/${cfg.questions}`;
  if(ss) ss.textContent = gameScore;
  if(st) st.textContent = gameStreak + '🔥';
}
function onCorrect(pts=10){
  gameScore += pts + (gameStreak>=3?5:0);
  gameStreak++;
  gameQNum++;
  updateGameHeader();
  const cfg = GAME_CONFIGS[currentGame];
  if(gameQNum >= cfg.questions){clearInterval(gameTimerInt);finishGame(false);}
}
function onWrong(){
  gameStreak = 0;
  updateGameHeader();
}
function finishGame(forced){
  clearInterval(gameTimerInt);
  gameActive = false; anticheatActive = false;
  const cfg = GAME_CONFIGS[currentGame];
  const pct = Math.round(gameScore/(cfg.questions*10)*100);
  const coinsEarned = forced ? 0 : Math.round(cfg.coins * (pct/100));
  const xpEarned = forced ? 0 : Math.round(cfg.xp * (pct/100));
  if(!forced){addCoins(coinsEarned); addXP(xpEarned);}
  document.getElementById('gameContent').innerHTML = `
    <div style="text-align:center;padding:30px">
      <div style="font-size:60px;margin-bottom:16px">${pct>=80?'🏆':pct>=50?'👍':'😅'}</div>
      <div style="font-size:48px;font-weight:900;font-family:'DM Mono',monospace;color:${pct>=80?'var(--green)':pct>=50?'var(--primary)':'var(--orange)'}">
        ${pct}%
      </div>
      <div style="font-size:16px;color:var(--text2);margin:8px 0 20px">
        ${gameScore} ball · ${gameQNum} savol to'g'ri${forced?' · ⚠️ Majburan tugatiladigan':''}
      </div>
      ${!forced?`<div style="display:flex;gap:16px;justify-content:center;margin-bottom:24px">
        <div style="text-align:center;padding:12px 20px;background:var(--purple-light);border-radius:var(--r2)">
          <div style="font-size:22px;font-weight:900;color:var(--purple)">+${xpEarned}</div>
          <div style="font-size:11px;color:var(--text2)">XP</div>
        </div>
        <div style="text-align:center;padding:12px 20px;background:var(--orange-light);border-radius:var(--r2)">
          <div style="font-size:22px;font-weight:900;color:var(--orange)">+${coinsEarned}</div>
          <div style="font-size:11px;color:var(--text2)">IDU Coin 🪙</div>
        </div>
      </div>`:''}
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn btn-secondary" onclick="exitGame()">← Orqaga</button>
        <button class="btn btn-primary" onclick="startGame('${currentGame}')">🔄 Qayta o'ynash</button>
      </div>
    </div>`;
}

// Math Game
let mathIdx = 0;
function renderMathQ(){
  const q = MATH_QUESTIONS[mathIdx % MATH_QUESTIONS.length];
  currentGameData = q;
  document.getElementById('gameContent').innerHTML = `
    <div class="math-question">
      <div class="math-expr">${q.expr}</div>
    </div>
    <div class="math-options">
      ${q.opts.map((o,i)=>`<div class="math-opt" onclick="checkMathOpt(this,'${o}','${q.answer}')">${o}</div>`).join('')}
    </div>
    <div class="math-feedback" id="mathFeedback"></div>`;
}
function checkMathOpt(el, chosen, correct){
  const opts = document.querySelectorAll('.math-opt');
  opts.forEach(o=>{o.classList.add('locked');if(o.textContent==correct)o.classList.add('correct');});
  const fb = document.getElementById('mathFeedback');
  if(String(chosen)===String(correct)){
    el.classList.add('correct');
    if(fb){fb.textContent='✅ To\'g\'ri! +10 ball';fb.style.color='var(--green)';}
    onCorrect(10);
    mathIdx++;
    setTimeout(()=>renderMathQ(),800);
  } else {
    el.classList.add('wrong');
    if(fb){fb.textContent='❌ Noto\'g\'ri! To\'g\'ri javob: '+correct;fb.style.color='var(--red)';}
    onWrong();
    setTimeout(()=>{mathIdx++;renderMathQ();},1200);
  }
}

// Prog Game
let progIdx = 0;
function renderProgQ(){
  const q = CODE_QUESTIONS[progIdx % CODE_QUESTIONS.length];
  currentGameData = q;
  document.getElementById('gameContent').innerHTML = `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text2)">🔍 Bo'sh joyni to'g'ri variant bilan to'ldiring:</div>
    <div class="code-block">${q.code.replace(q.blank,`<span class="code-blank" id="codeBlank">___</span>`)}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:10px">💡 Maslahat: ${q.hint}</div>
    <div class="code-opts">
      ${q.opts.map(o=>`<div class="code-opt" onclick="checkCodeOpt(this,'${o}','${q.answer}')">${o}</div>`).join('')}
    </div>
    <div id="progFeedback" style="font-size:14px;font-weight:700;min-height:24px;margin-top:8px"></div>`;
}
function checkCodeOpt(el, chosen, correct){
  document.querySelectorAll('.code-opt').forEach(o=>o.classList.add('used'));
  const blank = document.getElementById('codeBlank');
  const fb = document.getElementById('progFeedback');
  if(chosen===correct){
    if(blank){blank.textContent=chosen;blank.style.color='#4ADE80';blank.style.borderColor='#4ADE80';}
    if(fb){fb.textContent='✅ To\'g\'ri! Kodni yaxshi bilasiz!';fb.style.color='var(--green)';}
    onCorrect(15);
    progIdx++;
    setTimeout(()=>renderProgQ(),900);
  } else {
    if(blank){blank.style.borderColor='var(--red)';blank.style.color='var(--red)';}
    if(fb){fb.textContent=`❌ Noto'g'ri. To'g'ri: ${correct}`;fb.style.color='var(--red)';}
    onWrong();
    setTimeout(()=>{progIdx++;renderProgQ();},1300);
  }
}

// English Word Match Game
let engSelected = {left:null, right:null};
let engMatched = new Set();
let engPairs = [];
function renderEnglishGame(){
  engMatched.clear(); engSelected = {left:null,right:null};
  engPairs = [...ENGLISH_PAIRS].sort(()=>Math.random()-0.5).slice(0,6);
  const rightShuffled = [...engPairs].sort(()=>Math.random()-0.5);
  document.getElementById('gameContent').innerHTML = `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text2)">🔗 Inglizcha va O'zbekcha so'zlarni moslashtiring:</div>
    <div class="word-grid">
      <div class="word-col">
        ${engPairs.map((p,i)=>`<div class="word-card" id="wl${i}" onclick="selectWordCard('left',${i},'${p[0]}')">${p[0]}</div>`).join('')}
      </div>
      <div class="word-col">
        ${rightShuffled.map((p,i)=>`<div class="word-card" id="wr${i}" onclick="selectWordCard('right',${i},'${p[1]}','${p[0]}')" data-pair="${p[0]}">${p[1]}</div>`).join('')}
      </div>
    </div>
    <div id="engFeedback" style="text-align:center;font-size:14px;font-weight:700;min-height:28px;margin-top:12px"></div>`;
}
function selectWordCard(side, idx, val, pairKey){
  if(engSelected[side]!==null) return;
  const el = document.getElementById((side==='left'?'wl':'wr')+idx);
  if(el.classList.contains('matched'))return;
  el.classList.add('selected');
  engSelected[side] = {idx, val, pairKey, el};
  if(engSelected.left && engSelected.right){
    const lval = engSelected.left.val;
    const rkey = engSelected.right.pairKey;
    const match = engPairs.find(p=>p[0]===lval && p[0]===rkey);
    if(match){
      engSelected.left.el.classList.remove('selected');
      engSelected.right.el.classList.remove('selected');
      engSelected.left.el.classList.add('matched');
      engSelected.right.el.classList.add('matched');
      engMatched.add(lval);
      document.getElementById('engFeedback').textContent='✅ To\'g\'ri juftlik!';
      document.getElementById('engFeedback').style.color='var(--green)';
      onCorrect(10);
      if(engMatched.size>=engPairs.length){
        setTimeout(()=>finishGame(false),500);
      }
    } else {
      engSelected.left.el.classList.remove('selected');
      engSelected.right.el.classList.remove('selected');
      engSelected.left.el.classList.add('wrong-sel');
      engSelected.right.el.classList.add('wrong-sel');
      document.getElementById('engFeedback').textContent='❌ Noto\'g\'ri, qayta urinib ko\'ring!';
      document.getElementById('engFeedback').style.color='var(--red)';
      onWrong();
      setTimeout(()=>{
        engSelected.left.el.classList.remove('wrong-sel');
        engSelected.right.el.classList.remove('wrong-sel');
      },600);
    }
    engSelected = {left:null,right:null};
  }
}

// Physics Formula Game
let physMatched = new Set();
let physSelected = null;
function renderPhysicsGame(){
  physMatched.clear(); physSelected = null;
  const shuffled = [...PHYSICS_FORMULAS].sort(()=>Math.random()-0.5).slice(0,5);
  const namesShuffled = [...shuffled].sort(()=>Math.random()-0.5);
  document.getElementById('gameContent').innerHTML = `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text2)">⚛️ Formulalarni ularning nomlari bilan moslashtiring:</div>
    <div class="grid-2">
      <div id="physFormulas">${shuffled.map((f,i)=>`
        <div class="formula-card" id="pf${i}" onclick="selectFormula(${i},'${f.expr}')">
          <div class="formula-expr">${f.expr}</div>
        </div>`).join('')}</div>
      <div id="physNames">${namesShuffled.map((f,i)=>`
        <div class="formula-card" id="pn${i}" onclick="matchFormula(${i},'${f.expr}','${f.name}')" data-expr="${f.expr}" style="background:linear-gradient(135deg,#EDE9FE,#F5F3FF);border-color:#C4B5FD">
          <div style="font-size:14px;font-weight:700;color:var(--purple)">${f.name}</div>
        </div>`).join('')}</div>
    </div>
    <div id="physFeedback" style="text-align:center;font-size:14px;font-weight:700;min-height:28px;margin-top:10px"></div>`;
}
function selectFormula(idx, expr){
  document.querySelectorAll('[id^=pf]').forEach(e=>{if(!e.classList.contains('matched'))e.classList.remove('selected');});
  const el = document.getElementById('pf'+idx);
  if(el.classList.contains('matched'))return;
  el.classList.add('selected');
  physSelected = {idx, expr, el};
}
function matchFormula(idx, expr, name){
  if(!physSelected)return;
  const el = document.getElementById('pn'+idx);
  if(el.classList.contains('matched'))return;
  const fb = document.getElementById('physFeedback');
  if(physSelected.expr===expr){
    physSelected.el.classList.remove('selected');
    physSelected.el.classList.add('matched');
    el.classList.add('matched');
    physMatched.add(expr);
    if(fb){fb.textContent='✅ To\'g\'ri! '+physSelected.expr+' = '+name;fb.style.color='var(--green)';}
    onCorrect(15);
    physSelected = null;
    if(physMatched.size>=5) setTimeout(()=>finishGame(false),500);
  } else {
    physSelected.el.classList.remove('selected');
    el.classList.add('wrong-sel');
    if(fb){fb.textContent='❌ Noto\'g\'ri! Qayta urinib ko\'ring.';fb.style.color='var(--red)';}
    onWrong();
    setTimeout(()=>el.classList.remove('wrong-sel'),600);
    physSelected = null;
  }
}

// Algo Sorting Game
let sortArr=[], sortStep=0;
function renderAlgoGame(){
  sortArr = Array.from({length:6},()=>Math.floor(Math.random()*80+10));
  sortStep = 0;
  renderSortBars();
  document.getElementById('gameContent').innerHTML = `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text2)">📊 Massivni kichikdan kattaga tartiblay: ikkita ustunni bosib ularni almashtiring!</div>
    <div class="sort-arena"><div class="sort-bars" id="sortBars"></div></div>
    <div class="sort-controls" style="margin-bottom:14px">
      <button class="sort-btn sb-check" onclick="checkSorted()">✓ Tekshir</button>
      <button class="sort-btn" style="background:var(--bg);border-color:var(--border);color:var(--text2)" onclick="renderAlgoGame()">🔄 Yangi</button>
    </div>
    <div id="algoFeedback" style="text-align:center;font-size:14px;font-weight:700;min-height:28px"></div>`;
  setTimeout(()=>renderSortBars(),10);
}
let selectedBar = null;
function renderSortBars(){
  const el = document.getElementById('sortBars');
  if(!el)return;
  const colors=['#3B82F6','#7C3AED','#16A34A','#EA580C','#DB2777','#0D9488'];
  el.innerHTML = sortArr.map((v,i)=>`
    <div class="sort-bar" id="sb${i}" onclick="clickSortBar(${i})">
      <div class="sort-bar-val">${v}</div>
      <div class="sort-bar-rect" style="height:${v}px;background:${colors[i%colors.length]}"></div>
    </div>`).join('');
}
function clickSortBar(i){
  if(selectedBar===null){
    selectedBar=i;
    document.getElementById('sb'+i)?.style.setProperty('opacity','0.5');
  } else {
    // Swap
    [sortArr[selectedBar],sortArr[i]]=[sortArr[i],sortArr[selectedBar]];
    document.getElementById('sb'+selectedBar)?.style.setProperty('opacity','1');
    selectedBar=null;
    sortStep++;
    renderSortBars();
    onCorrect(5);
  }
}
function checkSorted(){
  const sorted=[...sortArr].sort((a,b)=>a-b);
  const isSorted=sortArr.every((v,i)=>v===sorted[i]);
  const fb=document.getElementById('algoFeedback');
  if(isSorted){
    document.querySelectorAll('.sort-bar-rect').forEach(b=>b.style.background='var(--green)');
    if(fb){fb.textContent='🎉 Ajoyib! Massiv to\'g\'ri tartibga solingan!';fb.style.color='var(--green)';}
    onCorrect(20);
    setTimeout(()=>finishGame(false),1500);
  } else {
    if(fb){fb.textContent='❌ Hali tartiblanmagan, davom eting!';fb.style.color='var(--red)';}
  }
}

// Logic Game
let logicIdx=0;
function renderLogicQ(){
  const q=LOGIC_QUESTIONS[logicIdx%LOGIC_QUESTIONS.length];
  document.getElementById('gameContent').innerHTML=`
    <div style="background:var(--bg);border-radius:var(--r2);padding:18px;margin-bottom:16px;border:1.5px solid var(--border)">
      <div style="font-size:12px;font-weight:700;color:var(--purple);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">🧩 Mantiq masalasi ${logicIdx+1}/${LOGIC_QUESTIONS.length}</div>
      <div style="font-size:15px;font-weight:600;line-height:1.6">${q.q}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${q.opts.map((o,i)=>`<div class="quiz-opt" onclick="checkLogic(this,${i},${q.ans})">
        <div class="opt-ltr">${'ABCD'[i]}</div>${o}
      </div>`).join('')}
    </div>
    <div id="logicFeedback" style="font-size:14px;font-weight:700;min-height:28px;margin-top:10px;text-align:center"></div>`;
}
function checkLogic(el,chosen,correct){
  document.querySelectorAll('#gameContent .quiz-opt').forEach((o,i)=>{
    o.classList.add('locked');
    if(i===correct)o.classList.add('correct');
    else if(i===chosen&&chosen!==correct)o.classList.add('wrong');
  });
  const fb=document.getElementById('logicFeedback');
  if(chosen===correct){
    if(fb){fb.textContent='🧠 Aqlli! To\'g\'ri javob!';fb.style.color='var(--green)';}
    onCorrect(20);
  } else {
    if(fb){fb.textContent='❌ Noto\'g\'ri! Mantiqni qayta o\'ylang.';fb.style.color='var(--red)';}
    onWrong();
  }
  logicIdx++;
  setTimeout(()=>renderLogicQ(),1000);
}

function renderGameHub(){
  updateXPDisplays();
  startDailyChallenge();
}

function startDailyChallenge(){
  const d=new Date();
  const end=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);
  const el=document.getElementById('dcCountdown');
  if(el){
    clearInterval(window.dcInt);
    window.dcInt=setInterval(()=>{
      const now=new Date();
      const diff=end-now;
      const h=Math.floor(diff/3600000);
      const m=Math.floor((diff%3600000)/60000);
      const s=Math.floor((diff%60000)/1000);
      el.textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    },1000);
  }
}

// ════════════════════════════════════
//  POMODORO
// ════════════════════════════════════
function setPomoMode(mins, label, el){
  document.querySelectorAll('.pomo-mode-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active');
  pomoDuration = mins*60;
  pomoRemaining = pomoDuration;
  clearInterval(pomoInterval);
  pomoRunning = false;
  document.getElementById('pomoStartBtn').textContent = '▶ Boshlash';
  document.getElementById('pomoLabel').textContent = label.toUpperCase();
  updatePomoDisplay();
}
function togglePomo(){
  if(pomoRunning){
    clearInterval(pomoInterval);
    pomoRunning = false;
    document.getElementById('pomoStartBtn').textContent = '▶ Davom ettirish';
  } else {
    pomoRunning = true;
    document.getElementById('pomoStartBtn').textContent = '⏸ Pauza';
    pomoInterval = setInterval(()=>{
      pomoRemaining--;
      updatePomoDisplay();
      if(pomoRemaining<=0){
        clearInterval(pomoInterval);
        pomoRunning=false;
        pomoTodaySessions++;
        if(pomoTodaySessions<=4){
          const pd=document.getElementById('pd'+(pomoTodaySessions-1));
          if(pd)pd.classList.add('done');
        }
        document.getElementById('pomoTodaySessions').textContent=pomoTodaySessions;
        pomoRemaining=pomoDuration;
        document.getElementById('pomoStartBtn').textContent='▶ Boshlash';
        showToast('🍅','Sessiya tugadi!',`Pomodoro #${pomoTodaySessions} yakunlandi! +20 XP`);
        addXP(20,'Pomodoro sessiyasi');
        addCoins(10);
        updateStreak();
      }
    },1000);
  }
}
function resetPomo(){
  clearInterval(pomoInterval);
  pomoRunning=false;
  pomoRemaining=pomoDuration;
  document.getElementById('pomoStartBtn').textContent='▶ Boshlash';
  updatePomoDisplay();
}
function updatePomoDisplay(){
  const m=Math.floor(pomoRemaining/60);
  const s=pomoRemaining%60;
  const el=document.getElementById('pomoTime');
  if(el)el.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  // Update circle
  const pct=(pomoRemaining/pomoDuration)*360;
  const circle=document.getElementById('pomoCircle');
  if(circle)circle.style.background=`conic-gradient(var(--primary) ${360-pct}deg, var(--bg2) ${360-pct}deg)`;
}
function updateStreak(){
  const today=new Date().toDateString();
  const lastDay=localStorage.getItem('idu_last_day');
  if(lastDay!==today){
    localStorage.setItem('idu_last_day',today);
    streakDays++;
    if(streakDays>streakRecord){streakRecord=streakDays;localStorage.setItem('idu_streak_record',streakRecord);}
    localStorage.setItem('idu_streak',streakDays);
    const sn=document.getElementById('streakNum');if(sn)sn.textContent=streakDays;
    const sr=document.getElementById('streakRecord');if(sr)sr.textContent=streakRecord;
    showToast('🔥','Streak!',`${streakDays} kunlik streak davom etmoqda!`);
  }
}

function renderTimePage(){
  updatePomoDisplay();
  const sn=document.getElementById('streakNum');if(sn)sn.textContent=streakDays;
  const sr=document.getElementById('streakRecord');if(sr)sr.textContent=streakRecord;
  renderWeeklyGoals();
}

// Weekly Goals
let goals=[
  {text:'Matematika fanini o\'rganing (2 soat)',done:false,xp:30},
  {text:'Dasturlash mashqlarini bajaring',done:true,xp:25},
  {text:'Ingliz tili so\'z o\'rganing (20 ta)',done:false,xp:20},
  {text:'3 ta Pomodoro sessiyasi o\'tkazing',done:false,xp:40},
  {text:'Quiz yechimlarini tekshiring',done:true,xp:15},
  {text:'Startup g\'oyangizni yangilang',done:false,xp:35},
  {text:'Davomat 100% bo\'lsin',done:true,xp:50},
];
function renderWeeklyGoals(){
  const el=document.getElementById('weeklyGoals');if(!el)return;
  el.innerHTML=goals.map((g,i)=>`
    <div class="goal-item">
      <div class="goal-checkbox${g.done?' done':''}" onclick="toggleGoal(${i})">${g.done?'✓':''}</div>
      <div class="goal-text${g.done?' done':''}">${g.text}</div>
      <div class="goal-xp">+${g.xp} XP</div>
    </div>`).join('');
  const done=goals.filter(g=>g.done).length;
  const pb=document.getElementById('weeklyProgressBar');if(pb)pb.style.width=(done/goals.length*100)+'%';
  const pt=document.getElementById('weeklyProgressText');if(pt)pt.textContent=`${done}/${goals.length}`;
}
function toggleGoal(i){
  const was=goals[i].done;
  goals[i].done=!goals[i].done;
  if(!was){addXP(goals[i].xp,'Maqsad bajarildi');addCoins(5);}
  renderWeeklyGoals();
}
function addGoal(){
  const text=prompt('Yangi maqsad kiriting:');
  if(text)goals.push({text,done:false,xp:20});
  renderWeeklyGoals();
}
function setMood(val,el){
  document.querySelectorAll('.mood-btn').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
  const advices={
    5:'Ajoyib! Bugungi kunda maksimal samaraga erishing! 🚀',
    4:'Yaxshi kayfiyat — o\'qish uchun ideal vaqt! 📚',
    3:'Normal kun. Pomodoro taymeri bilan boshlang! 🍅',
    2:'Yomon kun bo\'lsa ham, 1 soat o\'qish kifoya. 💪',
    1:'Charchadingiz — dam oling. 30 daqiqa yotib turing! 😴'
  };
  const el2=document.getElementById('moodAdvice');
  if(el2){el2.textContent=advices[val];el2.style.display='block';}
  addXP(5,'Kayfiyat belgilandi');
}

// ════════════════════════════════════
//  GAMIFICATION PAGE
// ════════════════════════════════════
const ACHIEVEMENTS=[
  {icon:'🎮',name:'Birinchi o\'yin',desc:'Birinchi o\'yinni o\'ynadi',earned:false},
  {icon:'🔥',name:'3 kunlik streak',desc:'3 kun ketma-ket o\'qish',earned:false},
  {icon:'🧠',name:'Matematik daho',desc:'Matematika o\'yinida 90%+',earned:false},
  {icon:'💻',name:'Dasturchi',desc:'Kod o\'yinida 5 marta to\'g\'ri',earned:false},
  {icon:'🏆',name:'Top 10',desc:'Guruh reytingida Top 10',earned:true},
  {icon:'🌟',name:'100 ta o\'yin',desc:'100 ta o\'yin o\'ynaldi',earned:false},
  {icon:'🪙',name:'Millioner',desc:'1000 IDU Coin to\'plansin',earned:false},
  {icon:'⚡',name:'5-daraja',desc:'5-darajaga yeting',earned:false},
];
const REWARDS=[
  {emoji:'📜',name:'Sertifikat shabloni',cost:200},
  {emoji:'🎨',name:'Maxsus profil rasmi',cost:150},
  {emoji:'🏷️',name:'Noyob nishon',cost:300},
  {emoji:'⏰',name:'Ekstra Pomodoro',cost:50},
  {emoji:'🔓',name:'Qo\'shimcha test urinish',cost:100},
  {emoji:'🎭',name:'Animatsiyali avatar',cost:500},
];
const LB_DATA=[
  {name:'Dilnoza Tosheva',xp:1840,coins:342,games:28},
  {name:'Mohira Xasanova',xp:1620,coins:298,games:24},
  {name:'Sherzod Raimov',xp:1480,coins:265,games:22},
  {name:'Feruza Sobirov',xp:1350,coins:240,games:20},
  {name:'Alisher Azimov',xp:playerXP||980,coins:playerCoins||180,games:gamesPlayed||15},
];
function renderGamification(){
  updateXPDisplays();
  renderAchievements();
  renderLB('xp');
  renderRewardShop();
}
function renderAchievements(){
  const el=document.getElementById('achievementsList');if(!el)return;
  el.innerHTML=ACHIEVEMENTS.map(a=>`
    <div class="badge-row" style="opacity:${a.earned?'1':'0.5'}">
      <div class="badge-icon">${a.icon}</div>
      <div><div class="badge-name">${a.name}</div><div class="badge-desc">${a.desc}</div></div>
      ${a.earned?`<div class="badge-reward" style="font-size:16px">✅</div>`:
      `<div style="font-size:11px;color:var(--text3);margin-left:auto">🔒</div>`}
    </div>`).join('');
}
function renderLB(key){
  const el=document.getElementById('gamificationLeaderboard');if(!el)return;
  const sorted=[...LB_DATA].sort((a,b)=>b[key]-a[key]);
  el.innerHTML=sorted.map((s,i)=>`
    <div class="rank-row${s.name.includes('Alisher')?` me`:''}">
      <div class="rank-pos${i<3?' rp-'+(i+1):''}">${i<3?['🥇','🥈','🥉'][i]:i+1}</div>
      <div class="rank-info"><div class="rank-name">${s.name}</div></div>
      <div class="rank-score">${key==='coins'?'🪙':key==='games'?'🎮':'⚡'} ${s[key]}</div>
    </div>`).join('');
}
function switchLB(key,el){
  document.querySelectorAll('.lb-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  renderLB(key);
}
function renderRewardShop(){
  const el=document.getElementById('rewardShop');if(!el)return;
  el.innerHTML=REWARDS.map(r=>`
    <div class="reward-item">
      <div class="reward-emoji">${r.emoji}</div>
      <div class="reward-name">${r.name}</div>
      <div class="reward-cost">🪙 ${r.cost}</div>
      <button class="btn btn-sm" style="margin-top:8px;width:100%;background:${playerCoins>=r.cost?'var(--primary)':'var(--bg2)'};color:${playerCoins>=r.cost?'white':'var(--text3)'};" onclick="buyReward('${r.name}',${r.cost})">${playerCoins>=r.cost?'Sotib olish':'Koin yetarli emas'}</button>
    </div>`).join('');
}
function buyReward(name,cost){
  if(playerCoins<cost){showToast('❌','Koin yetarli emas',`Kerak: ${cost} IDU Coin`);return;}
  playerCoins-=cost;
  updateXPDisplays();
  renderRewardShop();
  showToast('🎉','Sotib olindi!',`"${name}" muvaffaqiyatli sotib olindi!`);
}

// ════════════════════════════════════
//  APPLICATIONS SYSTEM
// ════════════════════════════════════
let APPLICATIONS = []; // {id, studentName, group, type:'cert'|'job', detail, price, company, date, status:'pending'|'approved'|'rejected', note}
let appIdCounter = 1;

// ════════════════════════════════════
//  PROFESSORS DATA
// ════════════════════════════════════
const PROFESSORS_DATA = [
  {id:1, name:'Prof. Rahimov J.',   short:'RJ', subject:'Machine Learning, Python for AI', dept:"Kompyuter fanlari", color:'#1B4FD8', tags:['ML','Python','AI'], totalReviews:0, ratings:[]},
  {id:2, name:'Prof. Yusupova M.',  short:'YM', subject:'Matematika (AI uchun), Data Science', dept:"Raqamli matematika", color:'#7C3AED', tags:['Matematika','Data Science'], totalReviews:0, ratings:[]},
  {id:3, name:'Prof. Ergashev T.',  short:'ET', subject:'Deep Learning, Computer Vision', dept:"Sun'iy intellekt", color:'#16A34A', tags:['Deep Learning','CV','TensorFlow'], totalReviews:0, ratings:[]},
  {id:4, name:'Prof. Rahimova N.',  short:'RN', subject:"Ingliz tili (Tech), Academic Writing", dept:"Chet tillar", color:'#EA580C', tags:['English','Tech Writing'], totalReviews:0, ratings:[]},
  {id:5, name:'Prof. Toshmatov S.', short:'TS', subject:'Neural Networks, NLP', dept:"Sun'iy intellekt", color:'#0D9488', tags:['NLP','Neural Networks'], totalReviews:0, ratings:[]},
  {id:6, name:'Prof. Karimova D.',  short:'KD', subject:'Cybersecurity, Network Security', dept:"Axborot xavfsizligi", color:'#DC2626', tags:['Cybersecurity','Networking'], totalReviews:0, ratings:[]},
  {id:7, name:'Prof. Nazarov B.',   short:'NB', subject:'Web Development, React, Node.js', dept:"Dasturlash texnologiyalari", color:'#0EA5E9', tags:['React','Node.js','Web'], totalReviews:0, ratings:[]},
  {id:8, name:'Prof. Holiqova S.',  short:'HS', subject:'Database Systems, PostgreSQL', dept:"Ma'lumotlar bazasi", color:'#A21CAF', tags:['SQL','Database','PostgreSQL'], totalReviews:0, ratings:[]},
];

// Seed some demo reviews
const PROF_REVIEWS_INIT = [
  {profId:1, overall:5, cats:[5,4,5,4], comment:"Juda yaxshi tushuntiradi, savollarimga har doim javob beradi!", time:'2 kun oldin'},
  {profId:1, overall:4, cats:[4,5,4,5], comment:"Darslar qiziqarli, lekin vazifalar ko'p. Umuman olganda yaxshi ustoz.", time:'5 kun oldin'},
  {profId:1, overall:5, cats:[5,5,5,4], comment:"ML bo'yicha eng yaxshi profil! Amaliy misollar juda foydali.", time:'1 hafta oldin'},
  {profId:2, overall:4, cats:[4,4,5,3], comment:"Matematikani juda chuqur o'rgatadi. Ba'zan tushunish qiyin.", time:'3 kun oldin'},
  {profId:2, overall:5, cats:[5,5,4,5], comment:"Data Science kursida eng yaxshi professor! Loyiha topshiriqlari real hayotga mos.", time:'1 hafta oldin'},
  {profId:3, overall:3, cats:[3,4,3,3], comment:"Mavzular qiyin lekin tushuntirish yetarli emas ba'zida.", time:'4 kun oldin'},
  {profId:3, overall:5, cats:[5,5,5,5], comment:"Computer Vision bo'yicha bilimi ajoyib! Har bir darsdan ilhom olaman.", time:'2 hafta oldin'},
  {profId:4, overall:5, cats:[5,5,5,5], comment:"Ingliz tilini o'rgatish uslubi juda samarali. Har darsdan yangi narsa o'rganaman.", time:'1 kun oldin'},
  {profId:4, overall:4, cats:[4,5,4,4], comment:"Yaxshi o'qituvchi, lekin ba'zan test savollari juda qiyin.", time:'3 kun oldin'},
  {profId:5, overall:4, cats:[4,4,5,4], comment:"NLP bo'yicha ko'p material beradi. Eng yaxshi tomonlari: amaliy loyihalar.", time:'5 kun oldin'},
  {profId:6, overall:5, cats:[5,5,5,4], comment:"Cybersecurity sohasida juda tajribali! Haqiqiy zaifliklarni ko'rsatadi.", time:'1 hafta oldin'},
  {profId:7, overall:4, cats:[4,4,4,5], comment:"React va Node.js juda yaxshi o'rgatadi. Portfolio loyihalari foydali.", time:'2 kun oldin'},
  {profId:8, overall:3, cats:[3,4,3,4], comment:"Database darslari tushunish oson, lekin chuqurlik yetishmaydi.", time:'3 kun oldin'},
];

// Initialize ratings from demo data
(function initProfRatings(){
  PROF_REVIEWS_INIT.forEach(r=>{
    const p = PROFESSORS_DATA.find(x=>x.id===r.profId);
    if(p){ p.ratings.push(r); p.totalReviews++; }
  });
})();

let _profReviewTarget = null; // professor being reviewed
let _prmStarVal = 0;
let _prmCatVals = [0,0,0,0];
let _profFilterDept = 'all';

function getProfAvgRating(prof){
  if(!prof.ratings.length) return 0;
  return prof.ratings.reduce((s,r)=>s+r.overall,0)/prof.ratings.length;
}
function getProfCatAvg(prof, catIdx){
  if(!prof.ratings.length) return 0;
  return prof.ratings.reduce((s,r)=>s+(r.cats[catIdx]||0),0)/prof.ratings.length;
}
function starsHtml(rating, size){
  const full=Math.floor(rating); const half=rating-full>=0.4;
  let h=''; for(let i=1;i<=5;i++){
    if(i<=full) h+=`<span style="font-size:${size||14}px;color:#FBBF24">★</span>`;
    else if(i===full+1&&half) h+=`<span style="font-size:${size||14}px;color:#FBBF24">½</span>`;
    else h+=`<span style="font-size:${size||14}px;color:#E2E8F0">★</span>`;
  } return h;
}
function getRatingDist(prof){
  const dist={1:0,2:0,3:0,4:0,5:0};
  prof.ratings.forEach(r=>{ dist[r.overall]=(dist[r.overall]||0)+1; });
  return dist;
}

function renderProfessorsPage(){
  const isRu = currentLang==='ru';
  // update page title
  const ptEl=document.getElementById('prof-page-title');
  if(ptEl) ptEl.textContent=isRu?'⭐ Оценки преподавателей':'⭐ Ustozlarni baholash';
  const psEl=document.getElementById('prof-page-sub');
  if(psEl) psEl.textContent=isRu?'Анонимные отзывы — ваше имя никогда не будет показано':'Anonim sharh va reyting — faqat siz ko\'rsatasiz, ism ko\'rinmaydi';

  const query=(document.getElementById('profSearchInput')?.value||'').toLowerCase();
  let profs = PROFESSORS_DATA.filter(p=>{
    const matchQ = !query || p.name.toLowerCase().includes(query) || p.subject.toLowerCase().includes(query) || p.tags.some(t=>t.toLowerCase().includes(query));
    const matchF = _profFilterDept==='all' || p.dept===_profFilterDept;
    return matchQ && matchF;
  });
  // Sort by avg rating desc
  profs.sort((a,b)=>getProfAvgRating(b)-getProfAvgRating(a));

  // Stats row
  const totalReviews = PROFESSORS_DATA.reduce((s,p)=>s+p.ratings.length,0);
  const allRatings = PROFESSORS_DATA.flatMap(p=>p.ratings.map(r=>r.overall));
  const globalAvg = allRatings.length ? (allRatings.reduce((s,r)=>s+r,0)/allRatings.length).toFixed(1) : '—';
  const statsEl=document.getElementById('profStatsRow');
  if(statsEl) statsEl.innerHTML=`
    <div class="prof-stat-card"><div class="prof-stat-val">${PROFESSORS_DATA.length}</div><div class="prof-stat-lbl">${isRu?'Преподавателей':'Ustozlar'}</div></div>
    <div class="prof-stat-card"><div class="prof-stat-val">${totalReviews}</div><div class="prof-stat-lbl">${isRu?'Отзывов':'Sharhlar'}</div></div>
    <div class="prof-stat-card"><div class="prof-stat-val">${globalAvg}★</div><div class="prof-stat-lbl">${isRu?'Средний рейтинг':'O\'rtacha reyting'}</div></div>
  `;

  // Filter row
  const depts = ['all',...new Set(PROFESSORS_DATA.map(p=>p.dept))];
  const filterEl=document.getElementById('profFilterRow');
  if(filterEl) filterEl.innerHTML=depts.map(d=>`
    <button class="filter-chip${_profFilterDept===d?' active':''}" onclick="_profFilterDept='${d}';renderProfessorsPage()">
      ${d==='all'?(isRu?'Все':'Barchasi'):d}
    </button>`).join('');

  // Professor grid
  const gridEl=document.getElementById('profGrid');
  if(!gridEl) return;
  if(!profs.length){
    gridEl.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:40px;color:#64748B">${isRu?'Преподаватели не найдены':'Ustoz topilmadi'}</div>`;
    return;
  }
  gridEl.innerHTML=profs.map(p=>{
    const avg=getProfAvgRating(p);
    const dist=getRatingDist(p);
    const recentReviews=p.ratings.slice(-2).reverse();
    const cats=[
      isRu?'📚 Объяснение':'📚 Tushuntirish',
      isRu?'⏰ Пунктуальность':'⏰ Vaqtinchalik',
      isRu?'🤝 Отношение':'🤝 Munosabat',
      isRu?'📝 Задания':'📝 Vazifalar'
    ];
    return `
    <div class="prof-card" id="profcard-${p.id}">
      <div class="prof-card-head">
        <div class="prof-avatar" style="background:${p.color}">${p.short}</div>
        <div style="flex:1">
          <div class="prof-name">${p.name}</div>
          <div class="prof-subject" style="font-size:11.5px">${p.subject}</div>
          <div style="font-size:10px;color:#94A3B8;margin-top:2px">🏛️ ${p.dept}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:20px;font-weight:900;color:#0F172A;line-height:1">${avg>0?avg.toFixed(1):'—'}</div>
          <div style="font-size:10px;color:#64748B">${isRu?`${p.ratings.length} отзывов`:`${p.ratings.length} sharh`}</div>
        </div>
      </div>
      <!-- Rating bar -->
      <div style="margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <div>${starsHtml(avg,15)}</div>
          <div style="font-size:11px;color:#94A3B8">${avg>0?avg.toFixed(1)+'/5':'—'}</div>
        </div>
        <div class="prof-rating-bar-wrap"><div class="prof-rating-bar-fill" style="width:${avg/5*100}%"></div></div>
      </div>
      <!-- Distribution (compact) -->
      ${p.ratings.length>0?`<div style="margin-bottom:10px">${[5,4,3,2,1].map(n=>`
        <div class="rating-dist-row">
          <div class="rating-dist-label">${n}★</div>
          <div class="rating-dist-bar"><div class="rating-dist-fill" style="width:${p.ratings.length?(dist[n]/p.ratings.length*100):0}%"></div></div>
          <div class="rating-dist-count">${dist[n]}</div>
        </div>`).join('')}</div>`:''}
      <!-- Tags -->
      <div class="prof-tags">${p.tags.map(t=>`<span class="prof-tag">${t}</span>`).join('')}</div>
      <!-- Category averages -->
      ${p.ratings.length>0?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
        ${cats.map((cat,ci)=>{
          const catAvg=getProfCatAvg(p,ci);
          return `<div style="background:#F8FAFC;border-radius:8px;padding:7px 10px">
            <div style="font-size:10px;color:#64748B;margin-bottom:3px">${cat}</div>
            <div style="font-size:12px;font-weight:700;color:#0F172A">${catAvg>0?catAvg.toFixed(1)+'★':'—'}</div>
          </div>`;
        }).join('')}
      </div>`:''}
      <!-- Recent reviews -->
      ${recentReviews.length?`<div class="prof-reviews-preview">
        <div style="font-size:11px;font-weight:700;color:#0F172A;margin-bottom:5px">${isRu?'Последние отзывы:':'So\'nggi sharhlar:'}</div>
        ${recentReviews.map(r=>`
          <div class="prof-review-item">
            <div class="prof-anon-badge">🔒 ${isRu?'Анонимно':'Anonim'} · ${r.time} · ${'★'.repeat(r.overall)}</div>
            ${r.comment?`<div>${r.comment}</div>`:''}
          </div>`).join('')}
      </div>`:'<div style="font-size:12px;color:#94A3B8;text-align:center;padding:8px">'+(isRu?'Ещё нет отзывов':'Hali sharh yo\'q')+'</div>'}
      <!-- Rate button -->
      <button class="prof-btn-rate" onclick="openProfReview(${p.id})">
        ⭐ ${isRu?'Оценить преподавателя':'Ustozni baholash'}
      </button>
    </div>`;
  }).join('');
}

function openProfReview(profId){
  const p = PROFESSORS_DATA.find(x=>x.id===profId);
  if(!p) return;
  _profReviewTarget = p;
  _prmStarVal = 0;
  _prmCatVals = [0,0,0,0];
  const isRu = currentLang==='ru';
  // Fill modal
  document.getElementById('prmTitle').textContent = isRu?'Оценить преподавателя':'Ustozni baholash';
  document.getElementById('prmAvatar').style.background = p.color;
  document.getElementById('prmAvatar').textContent = p.short;
  document.getElementById('prmProfName').textContent = p.name;
  document.getElementById('prmProfSub').textContent = p.subject;
  document.getElementById('prmStarLabel').textContent = isRu?'Общая оценка':'Umumiy baho';
  document.getElementById('prmStarHint').textContent = isRu?'Нажмите на звезду':'Yulduzni bosing';
  document.getElementById('prmCommentLabel').textContent = isRu?'Напишите отзыв':'Sharh yozing';
  document.getElementById('prmComment').placeholder = isRu?'Ваше мнение об этом преподавателе... (необязательно)':'Bu ustoz haqida fikringizni yozing... (ixtiyoriy)';
  document.getElementById('prmAnonText').textContent = isRu?'Ваш отзыв полностью анонимен — имя никогда не будет показано':'Sharhingiz to\'liq anonim — ismingiz hech qachon ko\'rinmaydi';
  document.getElementById('prmSubmitBtn').textContent = isRu?'⭐ Отправить оценку':'⭐ Baholashni yuborish';
  // Category labels
  const catLabels = isRu
    ? ['📚 Объяснение','⏰ Пунктуальность','🤝 Отношение','📝 Задания']
    : ['📚 Tushuntirish','⏰ Vaqtinchalik','🤝 Munosabat','📝 Vazifalar'];
  [1,2,3,4].forEach(i=>{
    const el=document.getElementById('prmCat'+i+'L');
    if(el) el.textContent=catLabels[i-1];
  });
  // Reset stars UI
  updatePrmStarsUI();
  [1,2,3,4].forEach(ci=>updatePrmCatUI(ci));
  document.getElementById('prmComment').value='';
  // Open modal
  document.getElementById('profReviewModal').style.display='flex';
  document.body.style.overflow='hidden';
}
function closeProfReview(){
  document.getElementById('profReviewModal').style.display='none';
  document.body.style.overflow='';
}
function setPrmStar(n){
  _prmStarVal=n;
  updatePrmStarsUI();
  const hints=['','😞 Juda yomon','😕 Yomon','😐 O\'rtacha','🙂 Yaxshi','😄 A\'lo'];
  const hintsRu=['','😞 Очень плохо','😕 Плохо','😐 Нормально','🙂 Хорошо','😄 Отлично'];
  const hintEl=document.getElementById('prmStarHint');
  if(hintEl) hintEl.textContent=(currentLang==='ru'?hintsRu:hints)[n]||'';
}
function updatePrmStarsUI(){
  const stars=document.querySelectorAll('#prmStarsRow .prm-star');
  stars.forEach((s,i)=>{
    s.classList.toggle('active',i<_prmStarVal);
  });
}
function setPrmCat(catIdx, n){
  _prmCatVals[catIdx-1]=n;
  updatePrmCatUI(catIdx);
}
function updatePrmCatUI(catIdx){
  const stars=document.querySelectorAll('#prmCat'+catIdx+' .prm-cat-star');
  stars.forEach((s,i)=>{
    s.classList.toggle('active',i<_prmCatVals[catIdx-1]);
  });
}
function submitProfReview(){
  const isRu=currentLang==='ru';
  if(!_prmStarVal){
    showToast('⚠️',isRu?'Ошибка':'Xato',isRu?'Umumiy baho qo\'yishingiz kerak!':'Umumiy baho qo\'yishingiz kerak!');
    return;
  }
  const comment=document.getElementById('prmComment').value.trim();
  const now=new Date();
  const timeStr=isRu?`Только что`:`Hozirgina`;
  const review={
    overall:_prmStarVal,
    cats:[..._prmCatVals],
    comment,
    time:timeStr
  };
  _profReviewTarget.ratings.push(review);
  _profReviewTarget.totalReviews++;
  closeProfReview();
  showToast('✅',isRu?'Отзыв отправлен!':'Sharh yuborildi!',isRu?'Fikringiz anonim saqlanadi':'Fikringiz anonim saqlanadi');
  renderProfessorsPage();
}

const PARTNERS=[
  {
    id:1, logo:'🛒', name:'Uzum Market', type:'IT kompaniya', color:'#F97316',
    desc:'O\'zbekistonning yetakchi e-commerce platformasi. 10M+ mijoz, 50M+ mahsulot.',
    website:'uzum.uz', location:'Toshkent', employees:'1000+',
    vacancies:[
      {id:101,title:'Junior Frontend Developer',salary:'3,000,000 – 5,000,000',stype:'Full-time',tags:['React','JavaScript','CSS'],desc:'React asosida foydalanuvchi interfeyslari yaratish va qo\'llab-quvvatlash.',requirements:['JavaScript va React bilimi','Git tajribasi','GPA 3.0+','Jamoa bilan ishlash qobiliyati']},
      {id:102,title:'Data Analyst',salary:'4,000,000 – 7,000,000',stype:'Full-time',tags:['Python','SQL','Tableau'],desc:'Sotuvlar va foydalanuvchi xulqini tahlil qilish, dashboard yaratish.',requirements:['Python va SQL bilimi','Statistika asoslari','Vizualizatsiya tajribasi']},
      {id:103,title:'QA Engineer',salary:'2,500,000 – 4,500,000',stype:'Full-time',tags:['Testing','Selenium','Manual'],desc:'Mobil va web ilovalarni manual va avtomatik testlash.',requirements:['Testing metodologiyasi','E\'tibor va aniqlik','JIRA bilan ishlash']},
    ]
  },
  {
    id:2, logo:'🚀', name:'EPAM Uzbekistan', type:'Global Software', color:'#1B4FD8',
    desc:'50+ mamlakatda faoliyat yurituvchi global IT xizmatlar kompaniyasi.',
    website:'epam.com', location:'Toshkent / Remote', employees:'58,000+',
    vacancies:[
      {id:201,title:'Software Engineer Trainee',salary:'2,000,000 – 4,000,000',stype:'Amaliyot',tags:['Java','Python','OOP'],desc:'EPAM Learning Lab dasturi — amaliyot va professional o\'sish imkoniyati.',requirements:['OOP bilimi','Ingliz tili B1+','Loyiha tajribasi yoki portfolio']},
      {id:202,title:'DevOps Engineer',salary:'8,000,000 – 15,000,000',stype:'Full-time',tags:['Docker','Kubernetes','CI/CD'],desc:'Infratuzilma avtomatlashtirish va deployment pipeline yaratish.',requirements:['Linux tajribasi 2+ yil','Docker va Kubernetes','CI/CD amaliyoti']},
      {id:203,title:'Business Analyst',salary:'5,000,000 – 9,000,000',stype:'Full-time',tags:['BPMN','Jira','Requirements'],desc:'Biznes talablarini texnik spesifikatsiyaga aylantirish va jamoani yo\'naltirish.',requirements:['BA asoslari','BPMN modellash','Ingliz tili B2+']},
      {id:204,title:'QA Automation Engineer',salary:'6,000,000 – 10,000,000',stype:'Full-time',tags:['Selenium','Java','TestNG'],desc:'Avtomatik test skriptlari yozish va test framework qurish.',requirements:['Java yoki Python','Selenium tajribasi','TestNG/JUnit bilimi']},
      {id:205,title:'Project Manager',salary:'7,000,000 – 12,000,000',stype:'Full-time',tags:['Agile','Scrum','PMP'],desc:'IT loyihalarni boshqarish, jamoani koordinatsiya qilish.',requirements:['PM tajribasi 2+ yil','Scrum/Kanban','Ingliz tili C1']},
    ]
  },
  {
    id:3, logo:'💻', name:'IT Park',type:'Texnopark', color:'#0D9488',
    desc:'O\'zbekistondagi IT ekotizimini rivojlantiruvchi davlat texnoparkasi.',
    website:'itpark.uz', location:'Toshkent', employees:'200+',
    vacancies:[
      {id:301,title:'Startup Coordinator',salary:'3,500,000 – 5,500,000',stype:'Full-time',tags:['Startup','Mentoring','Events'],desc:'Startap jamoalarini qo\'llab-quvvatlash va akselerator dasturlarini boshqarish.',requirements:['Startap ekotizimi bilimlari','Kommunikatsiya ko\'nikmalari','Loyiha boshqaruvi']},
      {id:302,title:'IT Specialist',salary:'4,000,000 – 6,000,000',stype:'Full-time',tags:['Network','Windows','Linux'],desc:'IT Park infratuzilmasini saqlash va texnik yordam ko\'rsatish.',requirements:['Tarmoq asoslari','Windows/Linux admin','Muammoni tezkor hal qilish']},
      {id:303,title:'Marketing Manager',salary:'4,500,000 – 7,000,000',stype:'Full-time',tags:['SMM','Content','Analytics'],desc:'IT Park ijtimoiy tarmoqlar, PR va brending strategiyasi.',requirements:['SMM tajribasi','Ijodiy yozish','Ingliz tili B1+']},
      {id:304,title:'Community Manager',salary:'3,000,000 – 4,500,000',stype:'Part-time',tags:['Events','Networking','Community'],desc:'IT hamjamiyat tadbirlarini tashkil etish va a\'zolar bilan muloqot.',requirements:['Tashkilotchilik','Ijtimoiy ko\'nikmalar','Telegram/Discord']},
      {id:305,title:'Grant Manager',salary:'5,000,000 – 8,000,000',stype:'Full-time',tags:['Grants','Finance','Reporting'],desc:'IT kompaniyalarga grant va subsidiya dasturlarini boshqarish.',requirements:['Moliya asoslari','Grant yozish','Ingliz tili B2+']},
      {id:306,title:'HR Specialist',salary:'3,500,000 – 5,000,000',stype:'Full-time',tags:['Recruitment','HR','Training'],desc:'IT Park xodimlari ishga qabul va o\'qitish dasturlari.',requirements:['HR asoslari','Intervyu o\'tkazish','Kuchli kommunikatsiya']},
    ]
  },
  {
    id:4, logo:'📡', name:'Beeline Uzbekistan', type:'Telekommunikatsiya', color:'#FBBF24',
    desc:'O\'zbekistondagi yetakchi telekommunikatsiya operatori. 10M+ abonent.',
    website:'beeline.uz', location:'Toshkent', employees:'3000+',
    vacancies:[
      {id:401,title:'Network Engineer',salary:'6,000,000 – 10,000,000',stype:'Full-time',tags:['Cisco','5G','Networking'],desc:'Tarmoq infratuzilmasini rejalashtirish va optimallashtirish.',requirements:['CCNA/CCNP sertifikati','3+ yil tajriba','5G texnologiyalari']},
      {id:402,title:'IT Support Specialist',salary:'3,000,000 – 5,000,000',stype:'Full-time',tags:['Helpdesk','Windows','Hardware'],desc:'Korporativ foydalanuvchilarga texnik yordam ko\'rsatish.',requirements:['IT asoslari','Muloqotchanlik','Stressga chidamlilik']},
    ]
  },
  {
    id:5, logo:'💳', name:'Humans.uz', type:'Fintech', color:'#7C3AED',
    desc:'O\'zbekistondagi fintech yetakchisi — to\'lov, kredit va bank xizmatlari.',
    website:'humans.uz', location:'Toshkent', employees:'500+',
    vacancies:[
      {id:501,title:'Mobile Developer (Flutter)',salary:'7,000,000 – 12,000,000',stype:'Full-time',tags:['Flutter','Dart','iOS/Android'],desc:'Humans super-app mobil ilovasi funksionallarini ishlab chiqish.',requirements:['Flutter/Dart 2+ yil','REST API integratsiya','iOS/Android publish tajribasi']},
      {id:502,title:'Backend Developer',salary:'8,000,000 – 14,000,000',stype:'Full-time',tags:['Python','Django','PostgreSQL'],desc:'To\'lov tizimi va API backend ishlab chiqish va qo\'llab-quvvatlash.',requirements:['Python/Django 2+ yil','PostgreSQL/Redis','Fintech bilimi + bonus']},
      {id:503,title:'Product Manager',salary:'9,000,000 – 16,000,000',stype:'Full-time',tags:['Product','Roadmap','Analytics'],desc:'Mahsulot strategiyasini belgilash va rivojlantirish yo\'nalishini boshqarish.',requirements:['PM tajribasi 3+ yil','Fintech tushunish','Ma\'lumotlarga asoslangan qaror']},
      {id:504,title:'UI/UX Designer',salary:'5,000,000 – 9,000,000',stype:'Full-time',tags:['Figma','UX','Design System'],desc:'Humans ilovasi dizayn tizimini rivojlantirish va yangi funksiyalar prototiplash.',requirements:['Figma/Adobe XD','UX tadqiqot metodlari','Portfolio talab qilinadi']},
    ]
  },
  {
    id:6, logo:'🏗️', name:'Texnoservis', type:'IT Outsourcing', color:'#059669',
    desc:'O\'rta Osiyo bo\'yicha IT outsourcing va digital transformation xizmatlari.',
    website:'texnoservis.uz', location:'Toshkent / Samarqand', employees:'150+',
    vacancies:[
      {id:601,title:'Full Stack Developer',salary:'5,000,000 – 10,000,000',stype:'Full-time',tags:['Node.js','React','MongoDB'],desc:'Mijozlar uchun web ilovalar yaratish — frontenddan backendgacha.',requirements:['Node.js va React bilimi','MongoDB/PostgreSQL','API dizayn tajribasi']},
      {id:602,title:'Python Developer (Intern)',salary:'1,500,000 – 2,500,000',stype:'Amaliyot',tags:['Python','Django','REST'],desc:'Boshlang\'ich darajadagi Python dasturchilarga amaliyot imkoniyati.',requirements:['Python asoslari','Django/Flask kirish darajasi','Ishlash va o\'rganish istagi']},
      {id:603,title:'System Administrator',salary:'4,500,000 – 7,500,000',stype:'Full-time',tags:['Linux','VMware','Backup'],desc:'Server va virtual infratuzilmani boshqarish va monitoring.',requirements:['Linux 2+ yil','VMware/HyperV','Zabbix/Nagios monitoring']},
    ]
  },
];

// ── Hamkorlar state ─────────────────────────────────
let _activeJobFilter = 'all';
let _activeDetailVacancy = null;
let _activeDetailPartner = null;
let _activePartnersTab = 'vacancies';

function renderPremiumPage(){
  // Update stats
  const totalVac = PARTNERS.reduce((s,p)=>s+p.vacancies.length,0);
  const myAppsCount = APPLICATIONS.filter(a=>a.studentName===currentUser?.name).length;
  const el1 = document.getElementById('hstat-vacancies'); if(el1) el1.textContent = totalVac;
  const el2 = document.getElementById('hstat-apps'); if(el2) el2.textContent = myAppsCount;
  // App badge
  const badge = document.getElementById('appCountBadge');
  if(badge){ badge.textContent=myAppsCount; badge.style.display=myAppsCount?'flex':'none'; }
  // Render current tab
  if(_activePartnersTab === 'vacancies') renderVacancies();
  else if(_activePartnersTab === 'companies') renderCompanies();
}

function switchPartnersTab(tab){
  _activePartnersTab = tab;
  ['vacancies','companies','certs'].forEach(t=>{
    const el = document.getElementById('tab-'+t); if(el) el.style.display = t===tab?'block':'none';
    const btn = document.getElementById('ptab-'+t); if(btn) btn.classList.toggle('active', t===tab);
  });
  if(tab==='vacancies') renderVacancies();
  else if(tab==='companies') renderCompanies();
}

function setJobFilter(type, btn){
  _activeJobFilter = type;
  document.querySelectorAll('.jf-chip').forEach(c=>c.classList.remove('active'));
  if(btn) btn.classList.add('active');
  renderVacancies();
}

function renderVacancies(){
  const el = document.getElementById('vacancyList'); if(!el) return;
  const q = (document.getElementById('vacancySearch')?.value||'').toLowerCase();
  const filter = _activeJobFilter;

  let html = '';
  let count = 0;
  PARTNERS.forEach(p=>{
    p.vacancies.forEach(v=>{
      if(filter !== 'all' && v.stype !== filter) return;
      if(q && !v.title.toLowerCase().includes(q) && !v.tags.join(' ').toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) return;
      count++;
      const alreadyApplied = APPLICATIONS.some(a=>a.studentName===currentUser?.name&&a.company===p.name&&a.detail===v.title);
      const stypeClass = v.stype==='Full-time'?'stype-full':v.stype==='Part-time'?'stype-part':'stype-intern';
      html += `
      <div class="vacancy-card" onclick="showJobDetail(${p.id},${v.id})">
        <div class="vc-top">
          <div class="vc-logo" style="background:${p.color}22">${p.logo}</div>
          <div style="flex:1;min-width:0">
            <div class="vc-company">${p.name} · ${p.location}</div>
            <div class="vc-title">${v.title}</div>
          </div>
          <div class="vc-salary">${v.salary} so'm</div>
        </div>
        <div class="vc-tags">${v.tags.map(t=>`<span class="vc-tag">${t}</span>`).join('')}</div>
        <div class="vc-bottom">
          <span class="stype-badge ${stypeClass}">${v.stype}</span>
          <span class="vc-location">📍 ${p.location}</span>
          <div style="margin-left:auto;display:flex;gap:8px">
            ${alreadyApplied
              ? `<span style="padding:5px 12px;background:var(--green-light);color:var(--green);border-radius:7px;font-size:12px;font-weight:700">✅ Yuborilgan</span>`
              : `<button class="btn btn-primary btn-sm" onclick="event.stopPropagation();applyJobDirect(${p.id},${v.id})">Ariza yuborish</button>`
            }
          </div>
        </div>
      </div>`;
    });
  });

  if(!count) html = `<div class="empty-state"><div class="empty-state-icon">🔍</div><div>Vakansiya topilmadi</div><div style="font-size:13px;color:var(--text3);margin-top:4px">Qidiruv so'zini o'zgartiring yoki filterni olib tashlang</div></div>`;
  el.innerHTML = html;
}

function renderCompanies(){
  const el = document.getElementById('companyGrid'); if(!el) return;
  el.innerHTML = PARTNERS.map(p=>`
    <div class="company-big-card" onclick="filterByCompany('${p.name}')">
      <div class="cbc-header" style="background:${p.color}"></div>
      <div class="cbc-body">
        <div class="cbc-logo">${p.logo}</div>
        <div class="cbc-name">${p.name}</div>
        <div class="cbc-type">${p.type} · ${p.employees} xodim</div>
        <div class="cbc-desc">${p.desc}</div>
        <div class="cbc-footer">
          <span class="cbc-vaccount">+${p.vacancies.length} vakansiya</span>
          <button class="btn btn-primary btn-sm">Ko'rish →</button>
        </div>
      </div>
    </div>`).join('');
}

function filterByCompany(name){
  _activeJobFilter = 'all';
  switchPartnersTab('vacancies');
  const search = document.getElementById('vacancySearch');
  if(search){ search.value = name; }
  document.querySelectorAll('.jf-chip').forEach(c=>c.classList.remove('active'));
  const allChip = document.querySelector('.jf-chip');
  if(allChip) allChip.classList.add('active');
  renderVacancies();
}

function showJobDetail(partnerId, vacancyId){
  const p = PARTNERS.find(x=>x.id===partnerId);
  const v = p?.vacancies.find(x=>x.id===vacancyId);
  if(!p||!v) return;
  _activeDetailPartner = p;
  _activeDetailVacancy = v;

  document.getElementById('jdmLogo').textContent = p.logo;
  document.getElementById('jdmLogo').style.background = p.color+'22';
  document.getElementById('jdmTitle').textContent = v.title;
  document.getElementById('jdmCompany').textContent = `${p.name} · ${p.type} · ${p.location}`;

  const stypeClass = v.stype==='Full-time'?'stype-full':v.stype==='Part-time'?'stype-part':'stype-intern';
  document.getElementById('jdmMeta').innerHTML = `
    <span class="stype-badge ${stypeClass}" style="padding:5px 12px">${v.stype}</span>
    <span style="padding:5px 12px;background:var(--green-light);color:var(--green);border-radius:7px;font-size:12px;font-weight:700">💰 ${v.salary} so'm</span>
    <span style="padding:5px 12px;background:var(--bg2);color:var(--text2);border-radius:7px;font-size:12px">📍 ${p.location}</span>`;

  document.getElementById('jdmDesc').textContent = v.desc;
  document.getElementById('jdmReqs').innerHTML = v.requirements.map(r=>`
    <div class="jdm-req-item"><span style="color:var(--green);font-size:16px;flex-shrink:0">✓</span> ${r}</div>`).join('');
  document.getElementById('jdmTags').innerHTML = v.tags.map(t=>`<span class="vc-tag" style="font-size:13px;padding:5px 12px">${t}</span>`).join('');

  const already = APPLICATIONS.some(a=>a.studentName===currentUser?.name&&a.company===p.name&&a.detail===v.title);
  const btn = document.getElementById('jdmApplyBtn');
  if(already){ btn.textContent='✅ Ariza allaqachon yuborilgan'; btn.disabled=true; btn.style.opacity='0.6'; }
  else { btn.textContent='📩 Ariza yuborish'; btn.disabled=false; btn.style.opacity='1'; }

  document.getElementById('jobDetailModal').style.display = 'flex';
}

function closeJobDetail(){
  document.getElementById('jobDetailModal').style.display = 'none';
}

function applyFromDetail(){
  if(!_activeDetailPartner || !_activeDetailVacancy) return;
  closeJobDetail();
  applyJobDirect(_activeDetailPartner.id, _activeDetailVacancy.id);
}

function applyJobDirect(partnerId, vacancyId){
  const p = PARTNERS.find(x=>x.id===partnerId);
  const v = p?.vacancies.find(x=>x.id===vacancyId);
  if(!p||!v) return;
  applyJob(p.name, p.type, p.vacancies.length, v.title, v.stype);
}

// ── LEGACY applyJob (updated signature) ─────────────


// ════ JOB APPLY MODAL ════
let currentApplyCompany = null;
let resumeFileData = null;

function applyJob(companyName, companyType, vacancy, preselectedPosition, positionType){
  if(!currentUser){ showToast('⚠️','Xato','Iltimos avval tizimga kiring'); return; }
  currentApplyCompany = {name:companyName, type:companyType, vacancy};

  // Find partner
  const partner = PARTNERS.find(p=>p.name===companyName);
  const positions = partner ? partner.vacancies.map(v=>v.title) : ['Umumiy ariza'];

  // Pre-fill user info
  const nameParts = (currentUser.name||'').split(' ');
  document.getElementById('applyFirstName').value = nameParts[1]||nameParts[0]||'';
  document.getElementById('applyLastName').value = nameParts[0]||'';
  document.getElementById('applyEmail').value = (currentUser.login||'')+'@idu.uz';
  document.getElementById('applyPhone').value = '';
  document.getElementById('applyBio').value = '';
  document.getElementById('applyFormError').style.display='none';

  // Set positions dropdown
  const sel = document.getElementById('applyPosition');
  sel.innerHTML = positions.map(p=>`<option>${p}</option>`).join('');
  if(preselectedPosition){ sel.value = preselectedPosition; }

  // Logo & title
  document.getElementById('jobModalLogo').textContent = partner?.logo||'🏢';
  document.getElementById('jobModalTitle').textContent = companyName;
  document.getElementById('jobModalSub').textContent = `${companyType} · +${vacancy} vakansiya`;

  // Check already applied
  const already = APPLICATIONS.find(a=>a.studentName===currentUser.name&&a.company===companyName&&a.type==='job'&&(!preselectedPosition||a.detail===preselectedPosition));
  document.getElementById('alreadyAppliedWarn').style.display = already ? 'block' : 'none';

  // Reset resume
  clearResume();

  // Open modal
  document.getElementById('jobApplyModal').style.display='flex';
}

function closeJobModal(){
  document.getElementById('jobApplyModal').style.display='none';
  currentApplyCompany = null;
  resumeFileData = null;
}

function handleResumeSelect(input){
  const file = input.files[0];
  if(!file) return;
  setResumeFile(file);
}

function handleResumeDrop(event){
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if(!file) return;
  document.getElementById('resumeDropZone').style.borderColor='var(--border2)';
  document.getElementById('resumeDropZone').style.background='var(--bg)';
  setResumeFile(file);
}

function setResumeFile(file){
  const allowed = ['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if(!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx)$/i)){
    showToast('❌','Noto\'g\'ri fayl turi','Faqat PDF, DOC, DOCX fayllar qabul qilinadi');
    return;
  }
  if(file.size > 5*1024*1024){
    showToast('❌','Fayl juda katta','Maksimal hajm: 5MB');
    return;
  }
  resumeFileData = {name: file.name, size: file.size, type: file.type};
  document.getElementById('resumeDropZone').style.display='none';
  const info = document.getElementById('resumeFileInfo');
  info.style.display='flex';
  document.getElementById('resumeFileName').textContent = file.name;
  const kb = (file.size/1024).toFixed(1);
  document.getElementById('resumeFileSize').textContent = kb > 1024 ? (kb/1024).toFixed(1)+' MB' : kb+' KB';
  document.getElementById('resumeDropText').textContent = file.name;
}

function clearResume(){
  resumeFileData = null;
  document.getElementById('resumeFileInput').value='';
  document.getElementById('resumeDropZone').style.display='block';
  document.getElementById('resumeFileInfo').style.display='none';
  document.getElementById('resumeDropText').textContent='Faylni bu yerga tashlang yoki bosing';
}

function submitJobApplication(){
  const firstName = document.getElementById('applyFirstName').value.trim();
  const lastName = document.getElementById('applyLastName').value.trim();
  const phone = document.getElementById('applyPhone').value.trim();
  const email = document.getElementById('applyEmail').value.trim();
  const position = document.getElementById('applyPosition').value;
  const bio = document.getElementById('applyBio').value.trim();
  const errEl = document.getElementById('applyFormError');

  // Validation
  if(!firstName || !lastName){
    errEl.textContent='❌ Ism va familiya to\'ldirilishi shart!'; errEl.style.display='block'; return;
  }
  if(!phone || phone.replace(/\s/g,'').length < 9){
    errEl.textContent='❌ Telefon raqam to\'g\'ri kiriting (9 raqam)!'; errEl.style.display='block'; return;
  }
  if(!resumeFileData){
    errEl.textContent='❌ Resume fayl yuklash majburiy!'; errEl.style.display='block'; return;
  }
  errEl.style.display='none';

  const now = new Date();
  const app = {
    id: appIdCounter++,
    studentName: currentUser.name,
    group: currentUser.group||'—',
    type: 'job',
    detail: position,
    company: currentApplyCompany.name,
    price: '—',
    phone: '+998 '+phone,
    email: email,
    fullName: lastName+' '+firstName,
    bio: bio,
    resumeFile: resumeFileData.name,
    resumeSize: resumeFileData.size,
    date: now.toLocaleDateString('uz-UZ'),
    dateRaw: now,
    status: 'pending',
    note: ''
  };
  APPLICATIONS.push(app);
  updateAppBadges();
  closeJobModal();
  showToast('📩','Ariza muvaffaqiyatli yuborildi!',`${currentApplyCompany?.name||'Kompaniya'} ga "${position}" lavozimi uchun ariza qabul qilindi`);
  addCoins(10,'Ish arizasi bonusi');
}

function buyCert(certName, price){
  if(!currentUser){ showToast('⚠️','Xato','Iltimos avval tizimga kiring'); return; }
  const already = APPLICATIONS.find(a=>a.studentName===currentUser.name&&a.detail===certName&&a.type==='cert');
  if(already){
    showToast('⚠️','Allaqachon buyurtma qilingan',`${certName} sertifikati uchun ariza berilgan (Holat: ${getStatusLabel(already.status)})`);
    return;
  }
  const now = new Date();
  const app = {
    id: appIdCounter++,
    studentName: currentUser.name,
    group: currentUser.group||'—',
    type: 'cert',
    detail: certName,
    company: 'IDU Sertifikat markazi',
    price: price+" so'm",
    date: now.toLocaleDateString('uz-UZ'),
    dateRaw: now,
    status: 'pending',
    note: ''
  };
  APPLICATIONS.push(app);
  updateAppBadges();
  showToast('🎓','Buyurtma qabul qilindi!',`${certName} sertifikati uchun ariza yuborildi. Dekanat tekshiradi.`);
  addCoins(20,'Sertifikat buyurtma bonusi');
}

function getStatusLabel(status){
  return {pending:'⏳ Kutilmoqda', approved:'✅ Tasdiqlandi', rejected:'❌ Rad etildi'}[status]||status;
}
function getStatusStyle(status){
  return {
    pending:'background:var(--yellow-light);color:var(--yellow)',
    approved:'background:var(--green-light);color:var(--green)',
    rejected:'background:var(--red-light);color:var(--red)'
  }[status]||'';
}

function updateAppBadges(){
  const pending = APPLICATIONS.filter(a=>a.status==='pending').length;
  // Dekanat badge
  const dekBadge = document.getElementById('dekAppBadge');
  if(dekBadge){ dekBadge.textContent=pending; }
  // Also update si-badge in sidebar for dekanat
  document.querySelectorAll('.sidebar-item').forEach(btn=>{
    if(btn.id==='si-dekanat-applications'){
      let sb=btn.querySelector('.si-badge');
      if(!sb&&pending>0){ sb=document.createElement('span'); sb.className='si-badge'; btn.appendChild(sb); }
      if(sb) sb.textContent=pending;
    }
  });
  // Student badge
  if(currentRole==='student'){
    const myApps = APPLICATIONS.filter(a=>a.studentName===currentUser?.name);
    const badge = document.getElementById('appCountBadge');
    if(badge){ badge.textContent=myApps.length; badge.style.display=myApps.length?'flex':'none'; }
  }
}

function renderMyApplications(){
  const el=document.getElementById('myApplicationsList');if(!el)return;
  const myApps = APPLICATIONS.filter(a=>a.studentName===currentUser?.name).sort((a,b)=>b.id-a.id);
  if(!myApps.length){
    el.innerHTML='<div class="empty-state"><div class="empty-state-icon">📭</div><div>Hali ariza yo\'q</div><div style="font-size:13px;color:var(--text3);margin-top:6px">Sertifikat buyurtma qiling yoki ish arizasi yuboring</div></div>';
    return;
  }
  el.innerHTML=myApps.map(a=>`
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
        <div style="font-size:28px">${a.type==='cert'?'🎓':'💼'}</div>
        <div style="flex:1">
          <div style="font-size:15px;font-weight:700">${a.detail}</div>
          <div style="font-size:12px;color:var(--text2);margin-top:2px">🏢 ${a.company}</div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">📅 ${a.date}${a.price!=='—'?' · 💰 '+a.price:''}</div>
          ${a.note?`<div style="margin-top:6px;padding:8px 10px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--text2)">💬 Dekanat izohi: <strong>${a.note}</strong></div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <span style="padding:5px 12px;border-radius:20px;font-size:12px;font-weight:700;${getStatusStyle(a.status)}">${getStatusLabel(a.status)}</span>
          <span style="font-size:11px;color:var(--text3)">#${a.id} · ${a.type==='cert'?'Sertifikat':a.type==='etiraz'?"⚠️ E'tiroz":'Ish arizasi'}</span>
        </div>
      </div>
    </div>`).join('');
}

let currentAppFilter = 'all';
function filterApps(filter, el){
  currentAppFilter = filter;
  document.querySelectorAll('#page-dekanat-applications .filter-chip').forEach(c=>c.classList.remove('active'));
  if(el) el.classList.add('active');
  renderDekanatApplications();
}

function renderDekanatApplications(){
  let apps = [...APPLICATIONS].sort((a,b)=>b.id-a.id);
  if(currentAppFilter==='cert') apps=apps.filter(a=>a.type==='cert');
  else if(currentAppFilter==='job') apps=apps.filter(a=>a.type==='job');
  else if(currentAppFilter==='etiraz') apps=apps.filter(a=>a.type==='etiraz');
  else if(currentAppFilter==='pending') apps=apps.filter(a=>a.status==='pending');

  // Update stats
  const el=document.getElementById('totalAppsCount');if(el)el.textContent=APPLICATIONS.length;
  const pe=document.getElementById('pendingAppsCount');if(pe)pe.textContent=APPLICATIONS.filter(a=>a.status==='pending').length;
  const ae=document.getElementById('approvedAppsCount');if(ae)ae.textContent=APPLICATIONS.filter(a=>a.status==='approved').length;

  const tbody=document.getElementById('applicationsBody');if(!tbody)return;
  if(!apps.length){
    tbody.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:30px">Hali ariza yo\'q</td></tr>';
    return;
  }
  tbody.innerHTML=apps.map(a=>`
    <tr>
      <td><strong>#${a.id}</strong></td>
      <td>
        <div style="font-weight:700">${a.fullName||a.studentName}</div>
        <div style="font-size:11px;color:var(--text3)">${a.studentName}</div>
        ${a.phone?`<div style="font-size:11px;color:var(--text2)">📞 ${a.phone}</div>`:''}
        ${a.email?`<div style="font-size:11px;color:var(--text2)">✉️ ${a.email}</div>`:''}
      </td>
      <td><span class="card-badge cb-blue">${a.group}</span></td>
      <td>${a.type==='cert'?'🎓 Sertifikat':a.type==='etiraz'?'<span style="padding:3px 8px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:6px;font-size:11px;font-weight:700;color:#EA580C">⚠️ E\'tiroz</span>':'💼 Ish arizasi'}</td>
      <td>
        <div style="font-weight:600">${a.detail}</div>
        <div style="font-size:11px;color:var(--text2)">📚 ${a.company}${a.price!=='—'?' · 💰 '+a.price:''}</div>
        ${a.note&&a.type==='etiraz'?`<div style="margin-top:6px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:7px;padding:6px 10px;font-size:12px;color:#92400E;max-width:260px">💬 <strong>Sabab:</strong> ${a.note}</div>`:''}
        ${a.resumeFile?`<div style="margin-top:4px;display:inline-flex;align-items:center;gap:5px;background:var(--primary-light);color:var(--primary);padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;cursor:pointer" onclick="showToast('📄','Resume','${a.resumeFile}')">📎 ${a.resumeFile}</div>`:''}
        ${a.bio?`<div style="font-size:11px;color:var(--text3);margin-top:3px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${a.bio}">💬 ${a.bio}</div>`:''}
      </td>
      <td style="font-size:12px;color:var(--text3)">${a.date}</td>
      <td><span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;${getStatusStyle(a.status)}">${getStatusLabel(a.status)}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${a.status==='pending'?`
            <button class="btn btn-sm" style="background:var(--green-light);color:var(--green);border:1px solid #86EFAC" onclick="updateAppStatus(${a.id},'approved')">✅ Tasdiqlash</button>
            <button class="btn btn-sm" style="background:var(--red-light);color:var(--red);border:1px solid #FCA5A5" onclick="updateAppStatus(${a.id},'rejected')">❌ Rad</button>
          `:`<button class="btn btn-sm btn-secondary" onclick="updateAppStatus(${a.id},'pending')">↩ Qaytarish</button>`}
          <button class="btn btn-sm btn-secondary" onclick="addNoteToApp(${a.id})">💬 Izoh</button>
        </div>
        ${a.note?`<div style="margin-top:6px;font-size:11px;color:var(--text2);background:var(--bg);padding:4px 8px;border-radius:6px">💬 ${a.note}</div>`:''}
      </td>
    </tr>`).join('');
}

function updateAppStatus(id, status){
  const app = APPLICATIONS.find(a=>a.id===id);
  if(!app) return;
  app.status = status;
  updateAppBadges();
  renderDekanatApplications();
  const msg = status==='approved'?`${app.studentName}ga ariza tasdiqlandi!`:status==='rejected'?`Ariza rad etildi`:'Ariza qaytarildi';
  showToast(status==='approved'?'✅':status==='rejected'?'❌':'↩','Holat yangilandi', msg);
}

function addNoteToApp(id){
  const app = APPLICATIONS.find(a=>a.id===id);
  if(!app) return;
  const note = prompt('Talabaga izoh yozing:', app.note||'');
  if(note !== null){ app.note = note; renderDekanatApplications(); showToast('💬','Izoh saqlandi',''); }
}

// ════════════════════════════════════
//  STARTUP ROLE TWEAK
// ════════════════════════════════════
// Fix add idea button visibility
const _origLaunchApp = launchApp;
launchApp = function(role,user){
  _origLaunchApp(role,user);
  const btn=document.getElementById('addIdeaBtn');
  if(btn) btn.style.display=(role==='student'||role==='dekanat')?'':'none';
};


// ════════ HEMIS NAV FUNCTIONS ════════

/* Smooth scroll to landing page section */
function navScrollTo(sectionId){
  const el = document.getElementById(sectionId);
  if(el){ el.scrollIntoView({behavior:'smooth', block:'start'}); }
}

/* Guide modal data per role */
const GUIDE_DATA = {
  student: {
    icon:'🎓', title:'Talabalar uchun yo\'riqnoma',
    steps:[
      {num:'1', title:'Tizimga kirish', desc:'Telefon raqamingizni kiriting, keyin SMS orqali tasdiqlash kodi yuboriladi. Kod bilan kirib, parolingizni tasdiqlang.'},
      {num:'2', title:'Dashboard', desc:'Tizimga kirganingizdan so\'ng siz o\'z dashboard-ingizni ko\'rasiz: fanlar, vazifalar, xabarlar va XP ball.'},
      {num:'3', title:'Vazifalar', desc:'Har bir fan bo\'yicha berilgan vazifalarni ko\'rib chiqing. Muddatiga e\'tibor bering va topshiriqlarni o\'z vaqtida yuboring.'},
      {num:'4', title:'Vaqt boshqaruvi', desc:'Pomodoro taymeri yordamida o\'qish sessiyalaringizni rejalashtiring. Har 25 daqiqada 5 daqiqa dam oling.'},
      {num:'5', title:'Hamkorlar', desc:'Ishga kirish imkoniyatlarini ko\'ring. Vakansiyalarga ariza topshiring va kompaniyalar bilan bog\'laning.'},
      {num:'6', title:'Parolni unutdim', desc:'Agar parolni unutsangiz, "Parolni unutdim" tugmasini bosing va telefon raqamingizga yangi ma\'lumotlar yuboring.'},
    ]
  },
  teacher: {
    icon:'👨‍🏫', title:'O\'qituvchilar uchun yo\'riqnoma',
    steps:[
      {num:'1', title:'Tizimga kirish', desc:'Login va parolingiz dekanat tomonidan beriladi. SMS tasdiqlash orqali tizimga kiring.'},
      {num:'2', title:'Fanlar boshqaruvi', desc:'O\'z fanlaringizni, ma\'ruza materiallarni va amaliy topshiriqlarni boshqaring.'},
      {num:'3', title:'Vazifalar berish', desc:'Talabalarga vazifalar bering, muddatlarini belgilang va baholash mezonlarini ko\'rsating.'},
      {num:'4', title:'Davomat', desc:'Har bir dars uchun talabalar davomat ma\'lumotlarini kiriting va hisobotlarni ko\'ring.'},
      {num:'5', title:'Baholash', desc:'Talabalar topshiriqlarini baholang, izohlar qo\'shing va natijalarni rasman tasdiqlang.'},
      {num:'6', title:'Startup loyihalari', desc:'Talabalar startup g\'oyalarini ko\'rib chiqing va mentorlik qiling.'},
    ]
  },
  dekanat: {
    icon:'🏛️', title:'Dekanat uchun yo\'riqnoma',
    steps:[
      {num:'1', title:'Tizimga kirish', desc:'Dekanat hisobi bilan login qiling. Barcha bo\'lim ma\'lumotlariga kirish imkoni bo\'ladi.'},
      {num:'2', title:'Talabalar ro\'yxati', desc:'Barcha talabalar, ularning o\'qish holati, to\'lovlari va fanlariga kirish.'},
      {num:'3', title:'O\'qituvchilar', desc:'O\'qituvchilar yuklama, darslar jadvali va baholash natijalarini kuzating.'},
      {num:'4', title:'Hisobotlar', desc:'Statistik hisobotlar: davomat, baholar, to\'lov holati — Excel-ga eksport qilish.'},
      {num:'5', title:'E\'lonlar', desc:'Barcha talabalar va o\'qituvchilarga xabar va e\'lonlar yuboring.'},
      {num:'6', title:'IDU Premium', desc:'Startup loyihalarini, hamkorlik takliflarini ko\'rib chiqing va tasdiqlang.'},
    ]
  },
  admin: {
    icon:'⚙️', title:'Administrator uchun yo\'riqnoma',
    steps:[
      {num:'1', title:'Admin paneli', desc:'Tizimning barcha funksiyalariga to\'liq kirish huquqi mavjud.'},
      {num:'2', title:'Foydalanuvchilar', desc:'Talabalar, o\'qituvchilar va dekanat hisoblarini yaratish, tahrirlash, o\'chirish.'},
      {num:'3', title:'Sozlamalar', desc:'Tizim parametrlarini, akademik yil va semestrlarga tegishli sozlamalarni o\'zgartirish.'},
      {num:'4', title:'SMS/OTP', desc:'Eskiz.uz integratsiyasini boshqaring. Demo/real rejimni almashtiring.'},
      {num:'5', title:'Xavfsizlik', desc:'Kirish jurnallarini ko\'ring, shubhali faoliyatni bloklang.'},
      {num:'6', title:'Zaxira', desc:'Ma\'lumotlar bazasini zahira nusxasini oling va tiklang.'},
    ]
  },
  kafedra: {
    icon:'📚', title:'Kafedra mudiri uchun yo\'riqnoma',
    steps:[
      {num:'1', title:'Kafedra paneli', desc:'O\'z kafedrangizdagi fanlar, o\'qituvchilar va talabalarni boshqaring.'},
      {num:'2', title:'O\'quv reja', desc:'Fanlar ro\'yxatini tahrirlang, kredit soatlarini belgilang.'},
      {num:'3', title:'O\'qituvchilar yuklamasi', desc:'Kafedra o\'qituvchilariga fanlar taqsimlanishini ko\'ring va yangilang.'},
      {num:'4', title:'Hisobotlar', desc:'Kafedra bo\'yicha statistika: o\'rtacha baholar, davomat, fan natijalari.'},
      {num:'5', title:'Nazorat', desc:'Imtihon natijalari va talabalar ishlarini monitoring qiling.'},
      {num:'6', title:'Hamkorlik', desc:'Tashqi tashkilotlar bilan hamkorlik takliflarini ko\'rib chiqing.'},
    ]
  },
};

const FAQ_DATA = [
  {q:'IDU tizimiga qanday kirish mumkin?', a:'Talabalar — student hisobi, o\'qituvchilar — teacher hisobi, dekanat — dekanat hisobi bilan kirishadi. Login va parol sms orqali yuboriladi.'},
  {q:'Parolni unutsam nima qilaman?', a:'"Parolni unutdim" tugmasini bosing, telefon raqamingizni kiriting. SMS orqali yangi login va parol yuboriladi.'},
  {q:'OTP (tasdiqlash kodi) kelmasa nima qilaman?', a:'30 soniya kutib, "Qayta yuborish" tugmasini bosing. Agar kelmasa, telefon raqamingiz to\'g\'ri ekanligini tekshiring.'},
  {q:'Hamkorlar bo\'limida qanday vakansiya topaman?', a:'Hamkorlar bo\'limiga o\'ting → "Vakansiyalar" tabini oching → Qidiruv yoki filtr orqali o\'zingizga mosini toping.'},
  {q:'Pomodoro taymer qanday ishlaydi?', a:'25 daqiqa o\'qish + 5 daqiqa dam olish = 1 sessiya. Har sessiyadan +20 XP olasiz. Vaqt bo\'limidan foydalaning.'},
  {q:'XP ball nima uchun kerak?', a:'XP ball orqali siz tizimda daraja oshirasiz va maxsus imtiyozlarga ega bo\'lasiz. Vazifalar, pomodoro, startup — barchasi XP beradi.'},
  {q:'Startup loyihasini qanday topshiraman?', a:'Startup bo\'limiga o\'ting, "Yangi g\'oya" tugmasini bosing va ma\'lumotlarni to\'ldiring. Dekanat ko\'rib chiqadi.'},
  {q:'Tizim qaysi brauzerda ishlaydi?', a:'Chrome, Firefox, Safari, Edge — barcha zamonaviy brauzerlar qo\'llab-quvvatlanadi. Eng yaxshi tajriba uchun Chrome tavsiya etiladi.'},
  {q:'Mobil qurilmada foydalanish mumkinmi?', a:'Ha, tizim to\'liq mobil qurilmalarga moslashtirilgan (responsive dizayn).'},
  {q:'Ma\'lumotlarim xavfsizmi?', a:'Ha. Barcha ma\'lumotlar shifrlangan, OTP 5 daqiqada o\'chadi, rate-limiting qo\'llaniladi. Parollar hech qachon ochiq saqlanmaydi.'},
];

function _openModal(id){
  const el=document.getElementById(id);
  if(el){el.style.display='flex';document.body.style.overflow='hidden';}
}
function _closeModal(id){
  const el=document.getElementById(id);
  if(el){el.style.display='none';document.body.style.overflow='';}
}

function openGuideModal(roleKey){
  const data = GUIDE_DATA[roleKey];
  if(!data) return;
  document.getElementById('guideModalIcon').textContent = data.icon;
  document.getElementById('guideModalTitle').textContent = data.title;
  document.getElementById('guideModalBody').innerHTML = data.steps.map(s=>`
    <div class="guide-step-card">
      <div class="guide-step-num">${s.num}</div>
      <div class="guide-step-content">
        <div class="guide-step-title">${s.title}</div>
        <div class="guide-step-desc">${s.desc}</div>
      </div>
    </div>
  `).join('');
  _openModal('guideModal');
}
function closeGuideModal(){ _closeModal('guideModal'); }

function openFaqModal(){
  document.getElementById('faqModalBody').innerHTML = FAQ_DATA.map((item,i)=>`
    <div class="faq-item" onclick="toggleFaq(${i})">
      <div class="faq-q" id="faq-q-${i}">
        <span>${item.q}</span>
        <span class="faq-arrow" id="faq-arr-${i}">▼</span>
      </div>
      <div class="faq-a" id="faq-a-${i}" style="display:none">${item.a}</div>
    </div>
  `).join('');
  _openModal('faqModal');
}
function closeFaqModal(){ _closeModal('faqModal'); }
function toggleFaq(i){
  const ans=document.getElementById('faq-a-'+i);
  const arr=document.getElementById('faq-arr-'+i);
  if(!ans) return;
  if(ans.style.display==='none'){ans.style.display='block';arr.textContent='▲';}
  else{ans.style.display='none';arr.textContent='▼';}
}

function openAboutModal(){ _openModal('aboutModal'); }
function closeAboutModal(){ _closeModal('aboutModal'); }

function openFeatModal(){ _openModal('featModal'); }
function closeFeatModal(){ _closeModal('featModal'); }

// Close modals on background click
['guideModal','faqModal','aboutModal','featModal'].forEach(id=>{
  const el = document.getElementById(id);
  if(el) el.addEventListener('click', function(e){
    if(e.target === this){
      _closeModal(id);
      document.body.style.overflow='';
    }
  });
});

// Dropdown toggle for Yo'riqnomalar
function toggleGuidesDropdown(e){
  e.stopPropagation();
  const menu = document.getElementById('navGuidesMenu');
  if(!menu) return;
  const isOpen = menu.style.display === 'block';
  // Close all dropdowns first
  document.querySelectorAll('.hn-drop-menu').forEach(m => m.style.display='none');
  if(!isOpen){ menu.style.display = 'block'; }
}
document.addEventListener('click', function(){
  document.querySelectorAll('.hn-drop-menu').forEach(m => m.style.display='none');
});

// ════════ MODAL ════════
function openLoginModal(){
  document.getElementById('loginModalBg').classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(function(){ var el=document.getElementById('mainLogin'); if(el) el.focus(); }, 80);
}
function closeLoginModal(e){
  if(e.target===document.getElementById('loginModalBg')) closeLoginModalForce();
}
function closeLoginModalForce(){
  // Agar foydalanuvchi tizimga kirmagan bo'lsa — modal yopilmaydi
  if (!currentUser) return;
  document.getElementById('loginModalBg').classList.remove('open');
  document.body.style.overflow='';
  // Reset new login form
  var lEl=document.getElementById('mainLogin'); if(lEl) lEl.value='';
  var pEl=document.getElementById('mainPass'); if(pEl){pEl.value='';pEl.type='password';}
  var errEl=document.getElementById('mainLoginError'); if(errEl) errEl.classList.remove('show');
  selectedRole=null;
}
function showVideoToast(){
  showToast('video','Video','Tez kunda qoshiladi!','blue');
}

// ════════ LANG DROPDOWN ════════
var currentLang='uz';
function toggleLangDrop(){
  var d=document.getElementById('langDrop');
  d.classList.toggle('open');
  document.removeEventListener('click',closeLangOnOutside);
  if(d.classList.contains('open')){
    setTimeout(function(){document.addEventListener('click',closeLangOnOutside);},10);
  }
}
function closeLangOnOutside(e){
  var d=document.getElementById('langDrop');
  if(d && !d.contains(e.target)){
    d.classList.remove('open');
    document.removeEventListener('click',closeLangOnOutside);
  }
}

var LANG_DATA = {
  uz:{
    flag:'🇺🇿', code:'UZ', name:"O'zbek",
    welcome:"Xush kelibsiz!",chooseRole:"Tizimga kirish uchun rolingizni tanlang",
    cont:"Davom etish",demo:"Demo hisoblar",back:"Orqaga qaytish",loginBtn:"Kirish",
    errCred:"Login yoki parol noto'g'ri",llLogin:"Login",llPass:"Parol",
    llCourse:"Kurs",llGroup:"Guruh",srvLogin:"Xizmat login",dept:"Bo'lim",adminLogin:"Admin login",company:"Kompaniya",
    stTitle:"Talaba kirishi",stSub:"Login va parolingizni kiriting",
    tcTitle:"Professor kirishi",tcSub:"Tizim hisobingiz ma'lumotlarini kiriting",
    dkTitle:"Dekanat kirishi",dkSub:"Dekanat administrator login ma'lumotlari",
    invTitle:"Investor kirishi",invSub:"Startup g'oyalarni ko'rish va baholash",
    stat1:"Talabalar",stat2:"O'qituvchilar",stat3:"Muvaffaqiyat",stat4:"Onlayn",stat5:"Fanlar",stat6:"Hamkorlar",
    badge:"",heroT:"International Digital University",
    heroS:"Zamonaviy ta'lim platformasi — talabalar, o'qituvchilar, dekanat va investorlar uchun yagona raqamli muhit.",
    video:"Video",kirish:"Kirish",navAbout:"Tizim haqida",navFeat:"Imkoniyatlar",navFaq:"FAQS",
    c1:"I kurs",c2:"II kurs",c3:"III kurs",c4:"IV kurs",optCh:"Tanlang",
    sdemo:"Talaba",tdemo:"O'qituvchi",idemo:"Investor"
  },
  ru:{
    flag:'🇷🇺', code:'RU', name:"Русский",
    welcome:"Добро пожаловать!",chooseRole:"Выберите свою роль для входа",
    cont:"Продолжить",demo:"Демо аккаунты",back:"Назад",loginBtn:"Войти",
    errCred:"Неверный логин или пароль",llLogin:"Логин",llPass:"Пароль",
    llCourse:"Курс",llGroup:"Группа",srvLogin:"Служебный логин",dept:"Кафедра",adminLogin:"Логин администратора",company:"Компания",
    stTitle:"Вход студента",stSub:"Введите логин и пароль",
    tcTitle:"Вход преподавателя",tcSub:"Введите данные вашего аккаунта",
    dkTitle:"Вход деканата",dkSub:"Данные администратора деканата",
    invTitle:"Вход инвестора",invSub:"Просмотр и оценка стартап-идей",
    stat1:"Студенты",stat2:"Преподаватели",stat3:"Успеваемость",stat4:"Онлайн",stat5:"Дисциплины",stat6:"Партнёры",
    badge:"Новая версия 5.0 доступна",heroT:"Интеллектуальная Цифровая Университет платформа",
    heroS:"Современная образовательная платформа — единая цифровая среда для студентов, преподавателей, деканата и инвесторов.",
    video:"Видео",kirish:"Войти",navAbout:"О системе",navFeat:"Возможности",navFaq:"FAQS",
    c1:"I курс",c2:"II курс",c3:"III курс",c4:"IV курс",optCh:"Выбрать",
    sdemo:"Студент",tdemo:"Преподаватель",idemo:"Инвестор"
  }
};

function setLang(lang){
  currentLang=lang;
  var L=LANG_DATA[lang];
  // Dropdown UI
  var d=document.getElementById('langDrop');
  if(d) d.classList.remove('open');
  document.removeEventListener('click',closeLangOnOutside);
  var flag=document.getElementById('lcFlag'); if(flag) flag.textContent=L.flag;
  var txt=document.getElementById('lcText'); if(txt) txt.textContent=L.code;
  var optUz=document.getElementById('lopt-uz'); if(optUz) optUz.classList.toggle('active',lang==='uz');
  var optRu=document.getElementById('lopt-ru'); if(optRu) optRu.classList.toggle('active',lang==='ru');

  function s(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
  // Navbar
  s('nav-about',L.navAbout); s('nav-features',L.navFeat); s('nav-faq',L.navFaq);
  s('nav-kirish',L.kirish);
  // Hero
  s('hero-title-text',L.heroT); s('hero-sub',L.heroS);
  s('hero-video',L.video);
  s('hstat1',L.stat1); s('hstat2',L.stat2); s('hstat3',L.stat3); s('hstat4',L.stat4); s('hstat5',L.stat5); s('hstat6',L.stat6);
  // Modal step-role
  s('t-welcome',L.welcome); s('t-choose-role',L.chooseRole); s('t-continue',L.cont); s('t-demo',L.demo);
  document.querySelectorAll('.role-card-title[data-uz]').forEach(function(el){el.textContent=lang==='uz'?el.dataset.uz:el.dataset.ru;});
  document.querySelectorAll('.role-card-sub[data-uz]').forEach(function(el){el.textContent=lang==='uz'?el.dataset.uz:el.dataset.ru;});
  // Student
  s('t-student-title',L.stTitle+' 🎓'); s('t-student-sub',L.stSub);
  s('t-err-cred',L.errCred); s('t-err-cred2',L.errCred);
  s('t-label-login',L.llLogin); s('t-label-pass',L.llPass);
  s('t-label-course',L.llCourse); s('t-label-group',L.llGroup);
  s('t-login-btn',L.loginBtn); s('t-login-btn2',L.loginBtn); s('t-login-btn3',L.loginBtn); s('t-login-btn4',L.loginBtn);
  s('t-back',L.back); s('t-back2',L.back); s('t-back3',L.back); s('t-back4',L.back);
  s('t-student-demo',L.sdemo);
  s('t-course1',L.c1); s('t-course2',L.c2); s('t-course3',L.c3); s('t-course4',L.c4);
  s('t-opt-choose',L.optCh);
  // Teacher
  s('t-teacher-title',L.tcTitle); s('t-teacher-sub',L.tcSub);
  s('t-srv-login',L.srvLogin); s('t-dept',L.dept); s('t-teacher-demo',L.tdemo);
  // Dekanat
  s('t-dekanat-title',L.dkTitle); s('t-dekanat-sub',L.dkSub); s('t-admin-login',L.adminLogin);
  // Investor
  s('t-investor-title',L.invTitle); s('t-investor-sub',L.invSub);
  s('t-company',L.company); s('t-investor-demo',L.idemo);
}

// ════ SMOOTH SCROLL ════
function goTo(id){
  var el=document.getElementById(id);
  if(el){el.scrollIntoView({behavior:'smooth',block:'start'});}
}

// ════ MODAL ════
function openLoginModal(){
  document.getElementById('loginModalBg').classList.add('open');
  document.body.style.overflow='hidden';
  setTimeout(function(){ var el=document.getElementById('mainLogin'); if(el) el.focus(); }, 80);
}
function closeLoginModal(e){
  if(e.target===document.getElementById('loginModalBg')) closeLoginModalForce();
}
function closeLoginModalForce(){
  document.getElementById('loginModalBg').classList.remove('open');
  document.body.style.overflow='';
  // Reset new login form
  var lEl=document.getElementById('mainLogin'); if(lEl) lEl.value='';
  var pEl=document.getElementById('mainPass'); if(pEl){pEl.value='';pEl.type='password';}
  var errEl=document.getElementById('mainLoginError'); if(errEl) errEl.classList.remove('show');
  selectedRole=null;
}

// ════ LANG DROPDOWN ════
var currentLang='uz';
function toggleLangDrop(){
  var d=document.getElementById('langDrop');
  d.classList.toggle('open');
  document.removeEventListener('click',closeLangOut);
  if(d.classList.contains('open')){
    setTimeout(function(){document.addEventListener('click',closeLangOut);},10);
  }
}
function closeLangOut(e){
  var d=document.getElementById('langDrop');
  if(d&&!d.contains(e.target)){d.classList.remove('open');document.removeEventListener('click',closeLangOut);}
}

var LD={
  uz:{flag:'🇺🇿',code:'UZ',
    navAbout:'Tizim haqida',navFeat:'Imkoniyatlar',navCont:'Kontaktlar',navPart:'Hamkorlar',
    kirish:'Kirish',
    heroT:"International Digital University",
    heroS:"Zamonaviy ta'lim platformasi — talabalar, o'qituvchilar, dekanat va investorlar uchun yagona raqamli muhit.",
    st1:'Talabalar',st2:"O'qituvchilar",st3:'Muvaffaqiyat',st4:'Onlayn',st5:'Fanlar',st6:'Hamkorlar',
    welcome:"Xush kelibsiz!",chooseRole:"Rolingizni tanlang",cont:"Davom etish",demo:"Demo hisoblar",
    back:"Orqaga qaytish",btn:"Kirish",err:"Login yoki parol noto'g'ri",
    ll:"Login",lp:"Parol",lc:"Kurs",lg:"Guruh",sl:"Xizmat login",dp:"Bo'lim",
    al:"Admin login",comp:"Kompaniya",
    stT:"Talaba kirishi",stS:"Login va parolingizni kiriting",
    tcT:"Professor kirishi",tcS:"Tizim hisobingiz ma'lumotlarini kiriting",
    dkT:"Dekanat kirishi",dkS:"Administrator login ma'lumotlari",
    invT:"Investor kirishi",invS:"Startup g'oyalarni ko'rish va baholash",
    c1:"I kurs",c2:"II kurs",c3:"III kurs",c4:"IV kurs",cho:"Tanlang",
    sd:"Talaba",td:"O'qituvchi",id:"Investor",
    // Sections
    saBadge:"Platforma haqida",saTitle:"Nima uchun IDU?",saSub:"Zamonaviy ta'lim tizimi — barcha jarayonlar yagona platformada.",
    saC1t:"Talabalar uchun",saC2t:"O'qituvchilar uchun",saC3t:"Dekanat uchun",
    sfBadge:"Xususiyatlar",sfTitle:"Asosiy imkoniyatlar",sfSub:"IDU platformasi ta'lim jarayonini to'liq raqamlashtiradi.",
    scBadge:"Bog'lanish",scTitle:"Kontaktlar",scSub:"Biz bilan bog'laning — javob berishdan mamnunmiz.",
    scLoc:"Manzil",scPhone:"Telefon",scEmail:"Email",scSocial:"Ijtimoiy tarmoqlar",scSocialSub:"Yangiliklar uchun kuzating",
    spBadge:"Hamkorlik",spTitle:"Bizning hamkorlar",spSub:"Yetakchi tashkilotlar va universitetlar bilan hamkorlik.",
    spCtaT:"Hamkor bo'lmoqchimisiz?",spCtaS:"IDU platformasi bilan birgalikda ta'limni yaxshilang.",spCtaBtn:"Bog'lanish →",
    // App UI — Dashboard
    appDashTitle:'Bosh sahifa',appBtnJadval:"📅 Jadval",appBtnQuiz:"🧠 Quiz boshlash",
    appBannerTitle:"IDU Platform — HEMIS o'rnini bosuvchi tizim",
    appBannerSub:"Oxirgi yangilanish: bugun 08:42 · Barcha ma'lumotlar joriy",
    appHb1:"Talabalar",appHb2:"Fanlar",appHb3:"Davomat",appHb4:"O'qituvchilar",
    appStatTotal:"Umumiy ball",appStatRating:"Reyting o'rni",appStatDavomat:"Davomat",appStatSemester:"Joriy semestr",
    appTodayTitle:"Bugungi darslar",appTasksTitle:"Yaqinlashayotgan vazifalar",appTasksBadge:"5 ta",
    appGradesTitle:"So'nggi baholar",appGradesAll:"Barchasi →",
    appAchTitle:"Yutuqlar 🏆",
    appAch1Name:"A'lochi talaba",appAch1Desc:"GPA 3.5+ saqlash",
    appAch2Name:"Devomli talaba",appAch2Desc:"95%+ davomat",
    appAch3Name:"Innovator",appAch3Desc:"Startup g'oya kiritish",
    appThFan:"Fan",appThJn:"JN",appThOn:"ON",appThYn:"YN",appThMi:"MI",appThJami:"Jami",appThBaho:"Baho",
    appChiqish:"Chiqish",
  },
  ru:{flag:'🇷🇺',code:'RU',
    navAbout:'О системе',navFeat:'Возможности',navCont:'Контакты',navPart:'Партнёры',
    kirish:'Войти',
    heroT:"International Digital University",
    heroS:"Современная образовательная платформа — единая цифровая среда для студентов, преподавателей, деканата и инвесторов.",
    st1:'Студенты',st2:'Преподаватели',st3:'Успеваемость',st4:'Онлайн',st5:'Дисциплины',st6:'Партнёры',
    welcome:"Добро пожаловать!",chooseRole:"Выберите роль",cont:"Продолжить",demo:"Демо аккаунты",
    back:"Назад",btn:"Войти",err:"Неверный логин или пароль",
    ll:"Логин",lp:"Пароль",lc:"Курс",lg:"Группа",sl:"Служебный логин",dp:"Кафедра",
    al:"Логин администратора",comp:"Компания",
    stT:"Вход студента",stS:"Введите логин и пароль",
    tcT:"Вход преподавателя",tcS:"Введите данные аккаунта",
    dkT:"Вход деканата",dkS:"Данные администратора",
    invT:"Вход инвестора",invS:"Просмотр стартап-идей",
    c1:"I курс",c2:"II курс",c3:"III курс",c4:"IV курс",cho:"Выбрать",
    sd:"Студент",td:"Преподаватель",id:"Инвестор",
    saBadge:"О платформе",saTitle:"Почему IDU?",saSub:"Современная система — все процессы в единой платформе.",
    saC1t:"Для студентов",saC2t:"Для преподавателей",saC3t:"Для деканата",
    sfBadge:"Функции",sfTitle:"Основные возможности",sfSub:"IDU полностью оцифровывает учебный процесс.",
    scBadge:"Связаться",scTitle:"Контакты",scSub:"Свяжитесь с нами — мы рады ответить.",
    scLoc:"Адрес",scPhone:"Телефон",scEmail:"Email",scSocial:"Социальные сети",scSocialSub:"Следите за новостями",
    spBadge:"Партнёрство",spTitle:"Наши партнёры",spSub:"Сотрудничество с ведущими организациями и университетами.",
    spCtaT:"Хотите стать партнёром?",spCtaS:"Вместе с IDU улучшайте образование.",spCtaBtn:"Связаться →",
    // App UI — Dashboard
    appDashTitle:'Главная',appBtnJadval:'📅 Расписание',appBtnQuiz:'🧠 Начать квиз',
    appBannerTitle:'IDU Platform — замена системы HEMIS',
    appBannerSub:'Последнее обновление: сегодня 08:42 · Все данные актуальны',
    appHb1:'Студенты',appHb2:'Дисциплины',appHb3:'Посещаемость',appHb4:'Преподаватели',
    appStatTotal:'Общий балл',appStatRating:'Место в рейтинге',appStatDavomat:'Посещаемость',appStatSemester:'Текущий семестр',
    appTodayTitle:'Сегодняшние занятия',appTasksTitle:'Предстоящие задания',appTasksBadge:'5 шт.',
    appGradesTitle:'Последние оценки',appGradesAll:'Все →',
    appAchTitle:'Достижения 🏆',
    appAch1Name:'Отличник',appAch1Desc:'Сохранять GPA 3.5+',
    appAch2Name:'Посещаемый студент',appAch2Desc:'Посещаемость 95%+',
    appAch3Name:'Инноватор',appAch3Desc:'Подать стартап-идею',
    appThFan:'Дисциплина',appThJn:'СКЗ',appThOn:'ОКЗ',appThYn:'ЯКЗ',appThMi:'ЭКЗ',appThJami:'Итого',appThBaho:'Оценка',
    appChiqish:'Выйти',
  }
};

function setLang(lang){
  currentLang=lang;
  var L=LD[lang];
  var d=document.getElementById('langDrop');if(d)d.classList.remove('open');
  document.removeEventListener('click',closeLangOut);
  var flag=document.getElementById('lcFlag');if(flag)flag.textContent=L.flag;
  var txt=document.getElementById('lcText');if(txt)txt.textContent=L.code;
  var ou=document.getElementById('lopt-uz');if(ou)ou.classList.toggle('active',lang==='uz');
  var or2=document.getElementById('lopt-ru');if(or2)or2.classList.toggle('active',lang==='ru');
  function s(id,v){var el=document.getElementById(id);if(el)el.textContent=v;}
  s('nav-about',L.navAbout);s('nav-features',L.navFeat);s('nav-contacts',L.navCont);s('nav-partners',L.navPart);
  s('nav-kirish',L.kirish);
  s('hero-title-text',L.heroT);s('hero-sub',L.heroS);
  s('hstat1',L.st1);s('hstat2',L.st2);s('hstat3',L.st3);s('hstat4',L.st4);s('hstat5',L.st5);s('hstat6',L.st6);
  // Sections
  s('sa-badge',L.saBadge);s('sa-title',L.saTitle);s('sa-sub',L.saSub);
  s('sa-c1t',L.saC1t);s('sa-c2t',L.saC2t);s('sa-c3t',L.saC3t);
  s('sf-badge',L.sfBadge);s('sf-title',L.sfTitle);s('sf-sub',L.sfSub);
  s('sc-badge',L.scBadge);s('sc-title',L.scTitle);s('sc-sub',L.scSub);
  s('sc-loc',L.scLoc);s('sc-phone',L.scPhone);s('sc-email',L.scEmail);
  s('sc-social',L.scSocial);s('sc-social-sub',L.scSocialSub);
  s('sp-badge',L.spBadge);s('sp-title',L.spTitle);s('sp-sub',L.spSub);
  s('sp-cta-t',L.spCtaT);s('sp-cta-s',L.spCtaS);s('sp-cta-btn',L.spCtaBtn);
  // Modal
  s('t-welcome',L.welcome);s('t-choose-role',L.chooseRole);s('t-continue',L.cont);s('t-demo',L.demo);
  document.querySelectorAll('.role-card-title[data-uz]').forEach(function(el){el.textContent=lang==='uz'?el.dataset.uz:el.dataset.ru;});
  document.querySelectorAll('.role-card-sub[data-uz]').forEach(function(el){el.textContent=lang==='uz'?el.dataset.uz:el.dataset.ru;});
  s('t-student-title',L.stT);s('t-student-sub',L.stS);
  s('t-err-cred',L.err);s('t-err-cred2',L.err);
  s('t-label-login',L.ll);s('t-label-pass',L.lp);s('t-label-course',L.lc);s('t-label-group',L.lg);
  s('t-login-btn',L.btn);s('t-login-btn2',L.btn);s('t-login-btn3',L.btn);s('t-login-btn4',L.btn);
  s('t-back',L.back);s('t-back2',L.back);s('t-back3',L.back);s('t-back4',L.back);
  s('t-student-demo',L.sd);
  s('t-course1',L.c1);s('t-course2',L.c2);s('t-course3',L.c3);s('t-course4',L.c4);
  s('t-opt-choose',L.cho);
  s('t-teacher-title',L.tcT);s('t-teacher-sub',L.tcS);s('t-srv-login',L.sl);s('t-dept',L.dp);s('t-teacher-demo',L.td);
  s('t-dekanat-title',L.dkT);s('t-dekanat-sub',L.dkS);s('t-admin-login',L.al);
  s('t-investor-title',L.invT);s('t-investor-sub',L.invS);s('t-company',L.comp);s('t-investor-demo',L.id);

  // ── App UI refresh (when user is already logged in) ──
  if(currentUser && currentRole){
    setupNav(currentRole);
    setupSidebar(currentRole);
    setupChip(currentRole, currentUser);
    // Re-activate current tab highlight
    if(currentPage){
      document.querySelectorAll('.topnav-tab').forEach(function(t){t.classList.remove('active');});
      document.querySelectorAll('.sidebar-item').forEach(function(t){t.classList.remove('active');});
      var tabEl=document.getElementById('tab-'+currentPage);
      var siEl=document.getElementById('si-'+currentPage);
      if(tabEl) tabEl.classList.add('active');
      if(siEl) siEl.classList.add('active');
    }
    // Re-render dynamic content with new language
    if(typeof initDates==='function') initDates();
    if(typeof renderTimetable==='function') renderTimetable();
    if(currentPage==='timetable' || currentPage==='teacher-timetable'){
      if(typeof renderTimetable==='function') renderTimetable();
    }

    // Update static dashboard IDs after render (setTimeout ensures DOM is settled)
    var _L = L;
    setTimeout(function(){
      function u(id,v){var e=document.getElementById(id);if(e)e.textContent=v;}
      u('dash-page-title',_L.appDashTitle);
      u('dash-btn-jadval',_L.appBtnJadval);
      u('dash-btn-quiz',_L.appBtnQuiz);
      u('dash-banner-title',_L.appBannerTitle);
      u('dash-banner-sub',_L.appBannerSub);
      u('dash-hb1',_L.appHb1);u('dash-hb2',_L.appHb2);u('dash-hb3',_L.appHb3);u('dash-hb4',_L.appHb4);
      u('dash-stat-total',_L.appStatTotal);u('dash-stat-rating',_L.appStatRating);
      u('dash-stat-davomat',_L.appStatDavomat);u('dash-stat-semester',_L.appStatSemester);
      u('dash-today-title',_L.appTodayTitle);u('dash-tasks-title',_L.appTasksTitle);
      u('dash-tasks-badge',_L.appTasksBadge);
      u('dash-grades-title',_L.appGradesTitle);u('dash-grades-all',_L.appGradesAll);
      u('dash-achieve-title',_L.appAchTitle);
      u('dash-ach1-name',_L.appAch1Name);u('dash-ach1-desc',_L.appAch1Desc);
      u('dash-ach2-name',_L.appAch2Name);u('dash-ach2-desc',_L.appAch2Desc);
      u('dash-ach3-name',_L.appAch3Name);u('dash-ach3-desc',_L.appAch3Desc);
      u('th-fan',_L.appThFan);u('th-jn',_L.appThJn);u('th-on',_L.appThOn);u('th-yn',_L.appThYn);
      u('th-mi',_L.appThMi);u('th-jami',_L.appThJami);u('th-baho',_L.appThBaho);
      // Stat changes
      var isRu=currentLang==='ru';
      u('dash-gpa-change', isRu?'↑ +0.2 прошлый семестр':"↑ +0.2 o'tgan semestr");
      u('dash-total-change', isRu?'↑ +23 эта неделя':'↑ +23 bu hafta');
      u('dash-rating-change', isRu?'↑ из 156':'↑ 156 ichida');
      // Timetable page buttons
      var isRuTT=currentLang==='ru';
      u('tt-page-title', isRuTT?'📅 Расписание':'📅 Dars jadvali');
      u('tt-btn-prev', isRuTT?'← Прошлая неделя':'← Oldingi hafta');
      u('tt-btn-cur',  isRuTT?'Текущая неделя':'Joriy hafta');
      u('tt-btn-next', isRuTT?'Следующая неделя →':'Keyingi hafta →');
      u('tt-btn-weekly', isRuTT?'Недельный':'Haftalik');
      u('tt-btn-daily',  isRuTT?'Дневной':'Kunlik');
      // Sidebar level name
      u('sidebarLevelName', isRuTT?'Новичок':'Yangi boshlovchi');
      // Chiqish / Выйти button
      var chiqishEl=document.querySelector('[onclick="logout()"]');
      if(chiqishEl) chiqishEl.textContent=_L.appChiqish||chiqishEl.textContent;
    }, 30);
  }
}

// ════════════════════════════════════
//  SAHIFA YUKLANGANDA: saqlangan sessiyani tekshirish
// ════════════════════════════════════
// ── v18: Global error handlers ────────────────────────────────────────────────
window.onerror = function(msg, src, line, col, err) {
  console.error('[IDU Error]', msg, 'at', src + ':' + line + ':' + col, err);
  return false; // don't suppress default
};
window.addEventListener('unhandledrejection', function(evt) {
  console.error('[IDU Unhandled Promise Rejection]', evt.reason);
});

window.addEventListener('DOMContentLoaded', function() {
  const saved = _lsGet('idu_session');
  if (saved) {
    loadSavedSession();
    setTimeout(function(){
      if(!currentUser) openLoginModal();
    }, 300);
  } else {
    openLoginModal();
  }
  // ── LIVE DATE & TIME BAR ──
  var DAYS_UZ=['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
  var MONTHS_UZ=['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
  function pad(n){return n<10?'0'+n:n;}
  function updateClock(){
    var now=new Date();
    var dayEl=document.getElementById('dtbDay');
    var dateEl=document.getElementById('dtbDate');
    var clockEl=document.getElementById('dtbClock');
    if(dayEl)dayEl.textContent=DAYS_UZ[now.getDay()];
    if(dateEl)dateEl.textContent=now.getDate()+' '+MONTHS_UZ[now.getMonth()]+' '+now.getFullYear()+' y.';
    if(clockEl)clockEl.textContent=pad(now.getHours())+':'+pad(now.getMinutes())+':'+pad(now.getSeconds());
  }
  updateClock();
  setInterval(updateClock,1000);
});


// ════════════════════════════════════
//  SESIYA STATE
// ════════════════════════════════════
var SESIYA_STATE = { test: false, real: false };
// ═══════════════════════════════════════════════
// TEST REJIM — SAVOLLAR BANKI (har bir fanda 20 ta)
// ═══════════════════════════════════════════════
var TEST_QUESTIONS_DB = {
  algo: [
    {q:"Quyidagi algoritmlardan qaysi biri O(n log n) vaqt murakkabligiga ega?", opts:["Bubble Sort","Merge Sort","Linear Search","Insertion Sort"], ans:1, izoh:"Merge Sort — bo'lib-bo'lib tartiblash (divide & conquer) usuli bo'lib, O(n log n) murakkablikka ega. Bubble va Insertion Sort O(n²), Linear Search esa O(n)."},
    {q:"Stack ma'lumotlar tuzilmasida qaysi tamoyil qo'llaniladi?", opts:["FIFO","LIFO","LILO","FILO"], ans:1, izoh:"Stack LIFO (Last In, First Out) tamoyilida ishlaydi — oxirgi kiritilgan element birinchi chiqariladi."},
    {q:"Binary Search algoritmi qaysi turdagi massivlarda ishlaydi?", opts:["Tartibsiz massiv","Tartiblangan massiv","Faqat raqamli massiv","Faqat matnli massiv"], ans:1, izoh:"Binary Search faqat tartiblangan massivlarda ishlaydi. U o'rtadan boshlayib, har safar massivning yarmini kesib tashlaydi — O(log n)."},
    {q:"Queue ma'lumotlar tuzilmasida qaysi tamoyil qo'llaniladi?", opts:["LIFO","FILO","FIFO","LILO"], ans:2, izoh:"Queue FIFO (First In, First Out) tamoyilida ishlaydi — birinchi kiritilgan element birinchi chiqariladi. Navbat kabi ishlaydi."},
    {q:"Rekursiv algoritmda nima bo'lmasa cheksiz rekursiya yuzaga keladi?", opts:["Parametr","Base case (to'xtash sharti)","Qaytish qiymati","O'zgaruvchi"], ans:1, izoh:"Base case — rekursiyaning to'xtash sharti. Bu bo'lmasa, funksiya o'zini cheksiz chaqirib, stack overflow xatosini keltirib chiqaradi."},
    {q:"Bubble Sort ning eng yomon holda vaqt murakkabligi qanday?", opts:["O(n)","O(log n)","O(n log n)","O(n²)"], ans:3, izoh:"Bubble Sort O(n²) murakkablikka ega, chunki har bir element boshqa barcha elementlar bilan taqqoslanadi."},
    {q:"Graf algoritmi DFS ning to'liq nomi nima?", opts:["Data First Search","Depth First Search","Direct Flow Search","Dynamic First Scan"], ans:1, izoh:"DFS — Depth First Search (Chuqurlik bo'yicha qidirish). Bitta yo'nalishda to'xtatilgunga qadar davom etadi, keyin orqaga qaytadi."},
    {q:"Hash table da kolliziya nima?", opts:["Xotira to'lishi","Ikkita kalit bir xil indeksga tushishi","Elementni o'chirish","Jadval hajmini o'zgartirish"], ans:1, izoh:"Kolliziya — ikki xil kalit bir xil hash indeksini hosil qilganda yuzaga keladi. Uni hal qilish uchun chaining yoki open addressing usullari ishlatiladi."},
    {q:"Dynamic Programming (DP) asosiy g'oyasi nima?", opts:["Muammoni bo'lib tashlash","Kichik muammolar natijalarini saqlash va qayta ishlatish","Tasodifiy qidirish","Parallel hisoblash"], ans:1, izoh:"DP — kichik muammolarning natijalarini memoization yoki tabulation orqali saqlash va qayta hisoblashni oldini olish."},
    {q:"Linked List da elementga kirish vaqt murakkabligi qanday?", opts:["O(1)","O(log n)","O(n)","O(n²)"], ans:2, izoh:"Linked List da elementlar ketma-ket bog'langan. n-chi elementga yetish uchun boshidan boshlab o'tish kerak — O(n)."},
    {q:"Quick Sort ning o'rtacha vaqt murakkabligi qanday?", opts:["O(n)","O(n log n)","O(n²)","O(log n)"], ans:1, izoh:"Quick Sort o'rtacha holda O(n log n) murakkablikka ega. Eng yomon holda (tartiblanmagan pivot) O(n²) bo'lishi mumkin."},
    {q:"Binary Tree da nechta bola tugun bo'lishi mumkin?", opts:["1 ta","2 ta","3 ta","Cheksiz"], ans:1, izoh:"Binary Tree da har bir tugunning maksimal 2 ta bolasi bo'ladi: chap (left) va o'ng (right)."},
    {q:"Greedy algoritm qanday strategiyadan foydalanadi?", opts:["Global optimalni qidirish","Har bir qadamda mahalliy optimal tanlov qilish","Barcha imkoniyatlarni sinash","Tasodifiy tanlov"], ans:1, izoh:"Greedy (ochko'z) algoritm har qadamda o'sha paytdagi eng yaxshi tanlovni qiladi, keyingi qadamlarni hisobga olmaydi."},
    {q:"Array va Linked List ning asosiy farqi nima?", opts:["Array katta, Linked List kichik","Array o'zgarmas, Linked List o'zgaruvchan","Array ketma-ket xotirada, Linked List tarqoq xotirada","Array sekin, Linked List tez"], ans:2, izoh:"Array elementlari xotirada ketma-ket joylashgan (index orqali O(1) kirish). Linked List esa tarqoq xotirada, pointerlar bilan bog'langan."},
    {q:"Dijkstra algoritmi nima uchun ishlatiladi?", opts:["Eng qisqa yo'l topish","Tartiblash","Qidirish","Kompressiya"], ans:0, izoh:"Dijkstra algoritmi grafda manba tugunidan barcha boshqa tugunlarga eng qisqa yo'lni topadi (musbat og'irlikli graflar uchun)."},
    {q:"Time Complexity va Space Complexity farqi nima?", opts:["Bir xil narsa","Time — vaqt, Space — xotira sarfi","Time — xotira, Space — vaqt","Ikkisi ham faqat xotira haqida"], ans:1, izoh:"Time Complexity algoritmning bajarilish vaqtini, Space Complexity esa ishlatiladigan xotira miqdorini o'lchaydi."},
    {q:"Selection Sort qanday ishlaydi?", opts:["Har safar minimal elementni topib, to'g'ri joyiga qo'yadi","Qo'shni elementlarni solishtiradi","Pivot orqali bo'ladi","Yarmini kesib tashlaydi"], ans:0, izoh:"Selection Sort har iteratsiyada massivning tartiblangan bo'lmagan qismidan minimal elementni topib, uni to'g'ri joyiga qo'yadi."},
    {q:"Palindrom so'zni tekshirishda qaysi ma'lumotlar tuzilmasi qulay?", opts:["Graf","Queue","Stack","Tree"], ans:2, izoh:"Stack yordamida so'zni teskari o'qish mumkin. Teskari o'qilganda asl so'z bilan bir xil bo'lsa — palindrom."},
    {q:"AVL tree qanday xususiyatga ega?", opts:["Har doim to'la (complete) bo'ladi","Har tugun uchun chap va o'ng daraxt balandligi farqi 1 dan oshmasligi","Faqat 3 darajali bo'ladi","Barcha tugunlar bir xil qiymatga ega"], ans:1, izoh:"AVL tree — o'z-o'zini muvozanatlaydigan BST. Har bir tugun uchun chap va o'ng subtree balandligi farqi maksimal 1 bo'ladi."},
    {q:"Fibonacci ketma-ketligini hisoblashda DP va rekursiya farqi nima?", opts:["Farq yo'q","DP keshlashtiradi, rekursiya qayta hisoblaydi","Rekursiya tezroq","DP ko'proq xotira ishlatmaydi"], ans:1, izoh:"Oddiy rekursiya Fibonacci(n) uchun O(2^n) vaqt ketkazadi (qayta hisoblaydi). DP memoization bilan O(n) ga tushiradi."}
  ],
  ai: [
    {q:"Machine Learning da 'overfitting' muammosi nima?", opts:["Model hech narsani o'rgana olmaydi","Model o'quv ma'lumotlariga juda yaxshi mos keladi, yangilarda yomon ishlaydi","Model barcha ma'lumotlarda bir xil ishlaydi","Model juda tez o'rganadi"], ans:1, izoh:"Overfitting — model o'quv ma'lumotlaridagi shovqin va tasodifiy naqshlarni ham o'rganib olishi. Natijada yangi ma'lumotlarda yomon ishlaydi (yuqori variance)."},
    {q:"Neyron tarmoqda 'activation function' nima uchun kerak?", opts:["Tezlikni oshirish uchun","Chiziqli bo'lmagan (non-linear) munosabatlarni o'rganish uchun","Xotira tejash uchun","Faqat chiqish qatlamida ishlatiladi"], ans:1, izoh:"Activation function neyron tarmoqqa chiziqli bo'lmagan (non-linear) imkoniyatlar qo'shadi. Ularsiz tarmoq faqat chiziqli funksiyalarni o'rganadi."},
    {q:"Supervised learning va Unsupervised learning farqi nima?", opts:["Supervised ko'proq ma'lumot talab qiladi","Supervised belgilangan (labeled) ma'lumot ishlatadi, Unsupervised yo'q","Unsupervised aniqroq","Farq yo'q"], ans:1, izoh:"Supervised learning belgilangan (label/javob mavjud) ma'lumotlar bilan o'rganadi. Unsupervised esa belgilanmagan ma'lumotlarda yashirin naqshlarni topadi."},
    {q:"CNN (Convolutional Neural Network) qaysi sohalarda keng ishlatiladi?", opts:["Matn tahlili","Rasm/Tasvirni aniqlash","Audio qayta ishlash","Faqat o'yinlarda"], ans:1, izoh:"CNN tasvirlar bilan ishlash uchun mo'ljallangan. Convolution operatsiyasi orqali rasmdan xususiyatlar (edge, texture, shape) oladi."},
    {q:"Gradient Descent algoritmining maqsadi nima?", opts:["Modelni tezlashtirish","Loss funksiyasini minimallash","Ma'lumotlarni tartiblash","Overfitting oldini olish"], ans:1, izoh:"Gradient Descent loss (xato) funksiyasini minimallash uchun model parametrlarini (weights, biases) gradient teskari yo'nalishida yangilaydi."},
    {q:"Reinforcement Learning da 'reward' nima?", opts:["O'quv ma'lumoti","Agent harakatiga berilgan rag'bat yoki jazo signali","Neyron tarmoq qatlami","Ma'lumotlar to'plami"], ans:1, izoh:"Reward — agentning muhitdagi harakatiga berilgan raqamli baho. Agent umumiy reward ni maksimallashtirishga o'rganadi (Q-learning, PPO)."},
    {q:"Natural Language Processing (NLP) da tokenization nima?", opts:["Matnni kriptolash","Matnni kichik bo'laklarga (token) ajratish","Matnni tarjima qilish","Grammatikani tekshirish"], ans:1, izoh:"Tokenization — matnni so'zlar, so'z bo'laklari yoki harflarga ajratish jarayoni. NLP modellar matnni to'g'ridan-to'g'ri emas, token indekslari orqali qayta ishlaydi."},
    {q:"Transfer Learning qanday ishlaydi?", opts:["Yangi modelni noldan o'rgatish","Oldindan o'rgatilgan modelni yangi vazifaga moslash","Ma'lumotlarni ko'chirish","Modelni soddalash"], ans:1, izoh:"Transfer Learning — katta ma'lumotlarda o'rgatilgan modelning bilimlarini yangi, kichikroq ma'lumotli vazifaga ko'chirish. Fine-tuning orqali amalga oshiriladi."},
    {q:"Random Forest qanday algoritmdan iborat?", opts:["Bitta kuchli qaror daraxti","Ko'p qaror daraxtlari yig'indisi (ensemble)","Klasterlash algoritmi","Chiziqli regressiya"], ans:1, izoh:"Random Forest — bagging asosidagi ensemble metod. Ko'plab qaror daraxtlari (decision trees) o'rgatiladi va ular ovoz berish (voting) orqali natija chiqaradi."},
    {q:"K-Means algoritmi qaysi guruhga kiradi?", opts:["Supervised learning","Unsupervised learning (klasterlash)","Reinforcement learning","Semi-supervised"], ans:1, izoh:"K-Means — unsupervised klasterlash algoritmi. U K ta markaz (centroid) atrofida ma'lumot nuqtalarini guruhlaydi, belgilangan ma'lumotlarsiz."},
    {q:"Precision va Recall o'lchovlarining farqi nima?", opts:["Bir xil narsa","Precision — to'g'ri musbat/jami musbat topilgan, Recall — to'g'ri musbat/jami haqiqiy musbat","Precision tezlik, Recall aniqlik","Faqat ikkilik klassifikatsiyada farq qiladi"], ans:1, izoh:"Precision = TP/(TP+FP): topilganlarning qanchasini to'g'ri. Recall = TP/(TP+FN): haqiqiy musbatlarning qanchasini topdik. F1-score ularning garmonik o'rtachasi."},
    {q:"LSTM nima uchun oddiy RNN dan yaxshiroq?", opts:["Tezroq o'rganadi","Uzoq muddatli bog'liqliklarni saqlaydi (vanishing gradient muammosini hal qiladi)","Kamroq parametrga ega","Faqat matn uchun"], ans:1, izoh:"LSTM (Long Short-Term Memory) — gate mexanizmlari (forget, input, output) orqali uzoq muddatli bog'liqliklarni saqlaydi. Oddiy RNN vanishing gradient muammosiga duchor bo'ladi."},
    {q:"Confusion matrix da True Positive nima?", opts:["Model noto'g'ri musbat dedi","Model to'g'ri musbat dedi","Model noto'g'ri manfiy dedi","Model to'g'ri manfiy dedi"], ans:1, izoh:"True Positive (TP) — model musbat dedi VA haqiqatda musbat. False Positive — model musbat dedi lekin manfiy. False Negative — model manfiy dedi lekin musbat edi."},
    {q:"Attention mechanism (Transformer) asosiy g'oyasi nima?", opts:["Barcha kirish elementlariga bir xil e'tibor","Muhim elementlarga ko'proq e'tibor qaratish","Ma'lumotlarni kompressiya qilish","Rekurrent bog'liqliklarni hisoblash"], ans:1, izoh:"Attention mexanizmi har bir element uchun boshqa barcha elementlar bilan aloqadorlikni hisoblaydi va muhimroqlarga katta og'irlik beradi. GPT, BERT asosi."},
    {q:"Batch Normalization nima uchun ishlatiladi?", opts:["Tezlikni oshirish","Trening jarayonini barqarorlashtirish va tezlashtirish","Xotira tejash","Overfitting uchun"], ans:1, izoh:"Batch Normalization har qatlam kirishini normallashtiradi. Bu gradient yo'qolishi/portlashini kamaytiradi, katta learning rate ishlatish imkonini beradi."},
    {q:"Dropout regularization nima?", opts:["Ma'lumotlarni o'chirish","Trening vaqtida tasodifiy neyronlarni o'chirish","Modelni kichraytirish","Aktivatsiya funksiyasini o'zgartirish"], ans:1, izoh:"Dropout — trening paytida har iteratsiyada neyronlarning bir qismini tasodifiy o'chiradi. Bu neyronlar bir-biriga haddan tashqari tayanmasligiga olib keladi (overfitting kamaytiradi)."},
    {q:"Support Vector Machine (SVM) asosiy g'oyasi nima?", opts:["Daraxt strukturasini qurish","Sinflar orasidagi maksimal chegarani (margin) topish","K ta klaster hosil qilish","Ehtimollik hisoblash"], ans:1, izoh:"SVM ikkita sinf orasidagi eng katta bo'shliqni (margin) ta'minlovchi ajratuvchi giperyuzani topadi. Support vectors — bu giperyuzaga eng yaqin nuqtalar."},
    {q:"Logistic Regression qaysi turdagi masalalar uchun ishlatiladi?", opts:["Regression (raqam taxmin qilish)","Klassifikatsiya (kategoriya aniqlash)","Klasterlash","Dimensiya qisqartirish"], ans:1, izoh:"Logistic Regression nomiga qaramay — klassifikatsiya algoritmi. Sigmoid funksiya orqali 0 va 1 orasidagi ehtimollik chiqaradi."},
    {q:"PCA (Principal Component Analysis) nima uchun kerak?", opts:["Model o'rgatish uchun","Ma'lumotlarning o'lchovini kamaytirish (dimensionality reduction)","Klasifikatsiya uchun","Overfitting uchun"], ans:1, izoh:"PCA ma'lumotlarni eng ko'p dispersiya saqlanadigan yangi o'qlar (principal components) ga proyeksiyalaydi. Ko'p o'lchovli ma'lumotlarni vizualizatsiya va siqish uchun ishlatiladi."},
    {q:"AI modelini baholashda Cross-Validation nima uchun kerak?", opts:["Modelni tezlashtirish","Modelning umumlashuvini (generalization) to'g'ri baholash","Ma'lumotlarni tozalash","Neyronlar sonini aniqlash"], ans:1, izoh:"Cross-Validation (k-fold) ma'lumotlarni k ta qismga bo'ladi va k marta o'rgatib-test qiladi. Bu modelning yangi ma'lumotlarda qanday ishlashini ishonchli baholaydi."}
  ],
  math: [
    {q:"Chiziqli algebra da matritsa determinanti nima uchun kerak?", opts:["Matritsani qo'shish uchun","Teskari matritsaning mavjudligini tekshirish va transformatsiyani ifodalash uchun","Matritsani ko'paytirish uchun","Matritsa izini topish uchun"], ans:1, izoh:"Determinant nolga teng bo'lmagan matritsa inversga (teskari) ega. Geometrik ma'noda — matritsa ifodalagan transformatsiyaning sirt yuzasini o'zgartirish koeffitsienti."},
    {q:"Gradient vektori nima?", opts:["Funksiyaning qiymati","Funksiyaning eng tez o'sish yo'nalishi va tezligi","Funksiyaning o'rtacha qiymati","Funksiyaning minimum nuqtasi"], ans:1, izoh:"Gradient — ko'p o'zgaruvchili funksiyaning barcha qisman hosilalaridan iborat vektor. U funksiya eng tez ortadigan yo'nalishni ko'rsatadi. Gradient Descent undan foydalanadi."},
    {q:"Ehtimollik nazariyasida Bayes teoremasi nima?", opts:["P(A|B) = P(B|A) · P(A) / P(B)","P(A|B) = P(A) + P(B)","P(A∩B) = P(A) · P(B)","P(A∪B) = P(A) - P(B)"], ans:0, izoh:"Bayes teoremasi shartli ehtimollikni qayta hisoblashga imkon beradi: P(A|B) = P(B|A)·P(A)/P(B). Naive Bayes, Bayesian inference asosi."},
    {q:"Eigenvalue va Eigenvector nima?", opts:["Matritsa elementlari","Av = λv tenglamasini qanoatlantiruvchi skalyar va vektor","Matritsa iz va determinanti","Tasodifiy vektorlar"], ans:1, izoh:"Eigenvector — matritsa bilan ko'paytirilganda yo'nalishi o'zgarmaydigan vektor. Eigenvalue — shu vektorning qanchaga cho'zilganini bildiradi (Av = λv)."},
    {q:"Chiziqli regression da 'least squares' metodi nima?", opts:["Hato kvadratlarini maksimallash","Hato kvadratlari yig'indisini minimallash","Hatoni 0 ga tenglashtirish","Barcha nuqtalardan o'tuvchi chiziq topish"], ans:1, izoh:"Least Squares — barcha nuqtalardan vertikal masofalar kvadratlari yig'indisini minimallaydi. Bu eng yaxshi moslik chizig'ini beradi."},
    {q:"Integral hisoblashning asosiy maqsadi nima?", opts:["Hosilani topish","Funksiya ostidagi maydonni topish","Funksiyaning maksimumini topish","Funksiyani soddalashtirish"], ans:1, izoh:"Aniq integral funksiya grafigi ostidagi maydonni hisoblaydi. Noaniq integral esa hosilasi berilgan funksiyadan — anthosilani topadi."},
    {q:"Korrelyatsiya koeffitsienti r = 1 bo'lsa, bu nimani anglatadi?", opts:["Bog'liqlik yo'q","To'liq musbat chiziqli bog'liqlik","To'liq manfiy bog'liqlik","Qisman bog'liqlik"], ans:1, izoh:"r = 1 — ikkita o'zgaruvchi orasida to'liq musbat chiziqli korrelyatsiya. Biri ortsa, ikkinchisi mutanosib ravishda ortadi. r = -1 teskari yo'nalishda."},
    {q:"Konveksiya (convexity) muammolarda nima kafolatlaydi?", opts:["Bitta mahalliy minimum mavjud","Ixtiyoriy mahalliy minimum — global minimum","Ko'p minimum mavjud","Minimum yo'q"], ans:1, izoh:"Konveks funksiyada ixtiyoriy mahalliy minimum — global minimum. Shuning uchun ML da konveks loss funksiyalar ishlash osonroq (Gradient Descent kafolatlangan holda yaqinlashadi)."},
    {q:"Softmax funksiyasi nima uchun ishlatiladi?", opts:["Ikkilik klassifikatsiya uchun","Ko'p sinfli klassifikatsiyada natijani ehtimollik vektoriga aylantirish uchun","Gradient hisoblash uchun","Aktivatsiya uchun"], ans:1, izoh:"Softmax ko'p sinf uchun chiqish vektorini ehtimollikka aylantiradi: e^zi / Σe^zj. Natijalar yig'indisi 1 ga teng bo'ladi."},
    {q:"Dispersion (variance) nima?", opts:["O'rtacha qiymat","Qiymatlarning o'rtachadan og'ishining kvadrat o'rtachasi","Maksimum va minimum farqi","Median qiymat"], ans:1, izoh:"Variance = E[(X - μ)²] — qiymatlar o'rtachadan qanchalik tarqalganini o'lchaydi. Standard deviation — variance ning kvadrat ildizi."},
    {q:"Eksponensial funksiya f(x) = e^x ning hosilasi nima?", opts:["x·e^(x-1)","e^x","x·e^x","1/e^x"], ans:1, izoh:"f(x) = e^x ning hosilasi o'zi — e^x. Bu matematik jihatdan noyob xususiyat: eksponensial funksiya o'z hosiliga teng."},
    {q:"Chiziqli mustaqillik (linear independence) nima degani?", opts:["Vektorlar bir xil yo'nalishda","Birorta vektorni boshqalari chiziqli kombinatsiyasi orqali ifodalab bo'lmaydi","Vektorlar bir-biriga tik","Vektorlar bir xil uzunlikda"], ans:1, izoh:"Chiziqli mustaqil vektorlar — ularning birontasini boshqalari chiziqli kombinatsiyasi bilan ifodalab bo'lmaydi. Bu matritsa rangini aniqlashda muhim."},
    {q:"Chi-squared (χ²) testi nima uchun ishlatiladi?", opts:["O'rtachalarni taqqoslash","Kategorik o'zgaruvchilar orasidagi bog'liqlikni tekshirish","Regressiya uchun","Klassifikatsiya uchun"], ans:1, izoh:"Chi-squared testi — kuzatilgan va kutilgan chastotalar o'rtasidagi farqni baholaydi. Kategorik ma'lumotlardagi bog'liqlik va mos kelishlikni tekshirishda ishlatiladi."},
    {q:"Logarifmik o'lchovning asosiy foydasi nima?", opts:["Hisob-kitobni qiyinlashtiradi","Katta sonlarni siqadi, eksponensial o'sishni chiziqli ko'rinishga keltiradi","Hamma qiymatlarni birga tenglashtiradi","Manfiy sonlarni musbatga aylantiradi"], ans:1, izoh:"Logarifm katta diapazonli ma'lumotlarni kichraytiradi (log scale). ML da cross-entropy loss log asosida, chunki ehtimolliklarni ko'paytirish o'rniga yig'indiga aylantiriladi."},
    {q:"Dot product (skalyar ko'paytma) a·b nima?", opts:["Vektor ko'paytmasi","Σ(ai·bi) — mos komponentlar ko'paytmasi yig'indisi","Vektorlar uzunligi ko'paytmasi","Vektorlar farqi"], ans:1, izoh:"Dot product a·b = Σ(ai·bi). Bu geometrik ma'noda |a|·|b|·cos(θ). Neyron tarmoqlarda har qatlam dot product + aktivatsiya funksiyasi orqali ishlaydi."},
    {q:"Funksiyaning ikkinchi tartibli hosila nima ko'rsatadi?", opts:["Funksiyaning qiymatini","Egilish (concavity) yo'nalishini — qavariqligi yoki botiqligini","Funksiyaning o'sish tezligini","Funksiyaning o'rtacha qiymatini"], ans:1, izoh:"Ikkinchi tartibli hosila f''(x) > 0 bo'lsa funksiya konveks (qavariq), f''(x) < 0 bo'lsa konkav (botiq). Optimizatsiyada mahalliy min/max aniqlashda ishlatiladi."},
    {q:"Monte Carlo metodi nima?", opts:["Analitik yechim usuli","Tasodifiy namunalar yordamida matematik miqdorlarni hisoblash","Deterministic algoritm","Matritsa operatsiyasi"], ans:1, izoh:"Monte Carlo — tasodifiy namunalar (simulation) orqali integralni, ehtimollikni yoki boshqa miqdorlarni hisoblash. Ko'p o'lchovli masalalar uchun samarali."},
    {q:"Rang (rank) matritsa uchun nima anglatadi?", opts:["Matritsa o'lchami","Chiziqli mustaqil satrlar (yoki ustunlar) soni","Matritsa determinanti","Matritsadagi nollar soni"], ans:1, izoh:"Matritsa rangi — chiziqli mustaqil satrlar yoki ustunlar maksimal soni. Chiziqli tenglamalar sistemasining yechimlari sonini aniqlaydi."},
    {q:"Normal taqsimot (Gaussian) qanday shaklga ega?", opts:["To'g'ri to'rtburchak","Qo'ng'iroqsimon (bell curve)","Uchburchak","Eksponensial"],  ans:1, izoh:"Normal taqsimot μ (o'rtacha) atrofida simmetrik qo'ng'iroqsimon shaklga ega. σ (standart og'ish) qanchalik katta bo'lsa, shu qadar keng tarqalgan."},
    {q:"Chiziqli algebra da vektor proyeksiyasi nima uchun kerak?", opts:["Vektorlarni qo'shish uchun","Bir vektorni boshqasi yo'nalishidagi tashkil etuvchisini topish uchun","Vektori uzunligini aniqlash uchun","Vektorlarni ko'paytirish uchun"], ans:1, izoh:"Proyeksiya — a vektorining b yo'nalishidagi tashkil etuvchisi: proj_b(a) = (a·b/|b|²)·b. PCA, Gram-Schmidt, attention mexanizmi asosi."}
  ],
  db: [
    {q:"SQL da PRIMARY KEY ning asosiy xususiyati nima?", opts:["NULL qabul qiladi","Noyob va NULL bo'lmagan qiymat kafolatlaydi","Faqat bitta jadvalda bo'ladi","Ko'p qatorlarda bir xil bo'lishi mumkin"], ans:1, izoh:"Primary Key — jadvaldagi har bir qatorni noyob identifikatsiya qiladi. NULL bo'lmasligi va noyobligi shart. Bitta jadvalda faqat bitta PK bo'lishi mumkin."},
    {q:"INNER JOIN va LEFT JOIN farqi nima?", opts:["Farq yo'q","INNER JOIN ikkala jadvalda mos qatorlarni, LEFT JOIN chap jadvalning barchasini qaytaradi","LEFT JOIN faqat chap jadval, INNER JOIN faqat o'ng jadval","INNER JOIN yangi jadval yaratadi"], ans:1, izoh:"INNER JOIN — faqat ikkala jadvalda mos yozuv bo'lganda qaytaradi. LEFT JOIN — chap jadvalning barcha qatorlarini, o'ngda mos yo'q bo'lsa NULL bilan qaytaradi."},
    {q:"Normalizatsiya (1NF, 2NF, 3NF) maqsadi nima?", opts:["Ma'lumotlarni siqish","Takrorlanishni kamaytirish va ma'lumotlar yaxlitligini ta'minlash","So'rovlarni tezlashtirish","Jadval sonini kamaytirish"], ans:1, izoh:"Normalizatsiya — ma'lumotlar takrorlanishini (redundancy) kamaytiradi va anomaliyalarni (insert, update, delete anomalies) oldini oladi."},
    {q:"Index (indeks) ma'lumotlar bazasida nima qiladi?", opts:["Ma'lumotlarni shifrlaydi","Qidirish va saralash so'rovlarini tezlashtiradi","Ma'lumotlarni arxivlaydi","Jadval hajmini kamaytiradi"], ans:1, izoh:"Index — ma'lumotlarning alohida ko'rsatkichi. Qidirish uchun butun jadvalni ko'rib chiqish o'rniga, index orqali to'g'ridan-to'g'ri kerakli qatorga boriladi."},
    {q:"ACID xususiyatlari nima?", opts:["Atomicity, Consistency, Isolation, Durability","Accuracy, Correctness, Integrity, Dependability","Availability, Consistency, Isolation, Delivery","Access, Control, Input, Data"], ans:0, izoh:"ACID — tranzaksiyalar xavfsizligini ta'minlovchi 4 xususiyat: Atomicity (hammasi yoki hech nima), Consistency (ma'lumotlar yaxlitligi), Isolation (tranzaksiyalar bir-birini ko'rmaydi), Durability (saqlangan ma'lumot yo'qolmaydi)."},
    {q:"NoSQL va SQL ma'lumotlar bazasining asosiy farqi nima?", opts:["NoSQL tezroq","SQL jadvallar, NoSQL moslashuvchan sxema (hujjat, kalit-qiymat, graf)","NoSQL SQL dan eski","SQL faqat kichik ma'lumotlar uchun"], ans:1, izoh:"SQL — relyatsion, qat'iy sxema, jadvallar. NoSQL — moslashuvchan: MongoDB (hujjat), Redis (kalit-qiymat), Neo4j (graf). Katta ma'lumotlar va gorizontal kengayish uchun qulay."},
    {q:"Stored Procedure nima?", opts:["Saqlangan jadval","Ma'lumotlar bazasida saqlangan, qayta foydalanish mumkin bo'lgan SQL buyruqlar to'plami","Indeks turi","Tranzaksiya turi"], ans:1, izoh:"Stored Procedure — serverda saqlangan va chaqirilganda bajariladigan SQL kodlar bloki. Murakkab operatsiyalarni markazlashtiradi, tarmoq yukini kamaytiradi."},
    {q:"FOREIGN KEY qanday cheklash (constraint) o'rnatadi?", opts:["Qiymat noyob bo'lishini ta'minlaydi","Boshqa jadvalning PRIMARY KEY ga mos qiymat bo'lishini ta'minlaydi (referential integrity)","NULL qiymatga yo'l qo'ymaydi","Qiymatlar doirasini cheklaydi"], ans:1, izoh:"Foreign Key — referential integrity: bir jadvalning ustuni boshqa jadval PK ga ishora qiladi. Bog'liq qatorni o'chirishga yoki bo'lmagan PK ni qo'shishga yo'l qo'ymaydi."},
    {q:"SQL da GROUP BY nima uchun ishlatiladi?", opts:["Ma'lumotlarni tartiblash uchun","Bir xil qiymatli qatorlarni guruhlash va agregat funksiya (COUNT, SUM, AVG) qo'llash uchun","Jadvallarni birlashtirish uchun","Dublikatlarni o'chirish uchun"], ans:1, izoh:"GROUP BY ma'lumotlarni ustun qiymati bo'yicha guruhlaydi. Har bir guruh uchun COUNT(), SUM(), AVG(), MAX(), MIN() funksiyalari qo'llaniladi."},
    {q:"Tranzaksiya rollback nima?", opts:["Tranzaksiyani tasdiqlash","Tranzaksiyani bekor qilish — barcha o'zgarishlarni qaytarish","Tranzaksiyani saqlash","Yangi tranzaksiya boshlash"], ans:1, izoh:"ROLLBACK — tranzaksiya ichidagi barcha o'zgarishlarni bekor qiladi va ma'lumotlarni tranzaksiya boshlanishidagi holatga qaytaradi."},
    {q:"Denormalization qachon qo'llaniladi?", opts:["Ma'lumotlar yaxlitligini oshirish uchun","O'qish so'rovlarini tezlashtirish uchun yozish tezligini qurbon qilish","Saqlash hajmini kamaytirish uchun","Normalizatsiya bilan bir xil"], ans:1, izoh:"Denormalization — jadvallarni birlashtirish yoki ma'lumotlarni takrorlash orqali JOIN larni kamaytiradi. O'qish juda ko'p, yozish kam bo'lgan sistemalarda (data warehouse) ishlatiladi."},
    {q:"ORM (Object-Relational Mapping) nima?", opts:["Ma'lumotlar bazasi interfeysi","Dastur ob'ektlarini jadval qatorlariga mos keltiradigan abstraktsiya qatlami","SQL optimizatsiya vositasi","Backup mexanizmi"], ans:1, izoh:"ORM (Django ORM, SQLAlchemy, Hibernate) — kod ob'ektlarini SQL jadvallariga avtomatik mos keltiradigan kutubxona. SQL yozmasdan Python/Java class lar bilan ishlash imkonini beradi."},
    {q:"Sharding ma'lumotlar bazasida nima?", opts:["Zaxira nusxasi yaratish","Ma'lumotlarni bir nechta server bo'ylab gorizontal taqsimlash","Jadvallarni indekslash","Tranzaksiyalarni boshqarish"], ans:1, izoh:"Sharding — katta ma'lumotlar bazasini mayda bo'laklarga (shard) bo'lib, alohida serverlariga joylash. Bu gorizontal kengayish (horizontal scaling) ni ta'minlaydi."},
    {q:"SQL da HAVING vs WHERE farqi nima?", opts:["Bir xil narsa","WHERE qatorlarni filtrdan o'tkazadi (guruhlanishdan oldin), HAVING guruhlarni filtrdan o'tkazadi (GROUP BY dan keyin)","HAVING yangi ustun yaratadi","WHERE faqat raqamlar uchun"], ans:1, izoh:"WHERE — GROUP BY bajarilishidan oldin qatorlarni filtrlaydi. HAVING — guruhlangandan keyin guruh shartlarini filtrlaydi (masalan: HAVING COUNT(*) > 5)."},
    {q:"Cursor (kursorlar) ma'lumotlar bazasida nima uchun?", opts:["Foydalanuvchi interfeysi uchun","So'rov natijasini qator-qator qayta ishlash uchun","Jadval yaratish uchun","Indeks yaratish uchun"], ans:1, izoh:"Cursor — so'rov natijasini bir butun sifatida emas, qator-qator qayta ishlash imkonini beradi. Stored procedure va murakkab ma'lumot qayta ishlashda ishlatiladi."},
    {q:"B-tree indeks qanday ma'lumotlarda samarali?", opts:["Faqat raqamlarda","Tartiblash va diapazon so'rovlarida (>, <, BETWEEN)","Faqat matnlarda","Faqat LIKE so'rovlarida"], ans:1, izoh:"B-tree (Balanced tree) indeks — tartiblangan ma'lumotlar uchun. = dan tashqari >, <, BETWEEN, ORDER BY kabi diapazon so'rovlarda ham samarali."},
    {q:"Replication (replikatsiya) nimani ta'minlaydi?", opts:["Ma'lumotlarni siqish","Yuqori mavjudlik (high availability) va yuk balansi uchun ma'lumotlar nusxasini saqlash","Tranzaksiyalar xavfsizligi","Normalizatsiya"], ans:1, izoh:"Replication — master/slave arxitekturasida ma'lumotlar asosiy serverdan secondary serverlarga ko'chiriladi. O'qish yukini taqsimlaydi va xato holatida zaxira bo'ladi."},
    {q:"SQL da VIEW nima?", opts:["Haqiqiy jadval","Virtual jadval — saqlangan so'rov natijasi","Takrorlangan jadval","Vaqtinchalik jadval"], ans:1, izoh:"VIEW — saqlangan SELECT so'rovi. Jadval kabi ishlatiladi, lekin ma'lumotlar yo'q — so'rov chaqirilganda bajariladi. Murakkab so'rovlarni soddalashtiradi."},
    {q:"Ma'lumotlar bazasida trigger nima?", opts:["Foydalanuvchi tugmasi","Jadvalda qo'shish/o'zgartirish/o'chirish hodisasida avtomatik bajariladigan kod","Tranzaksiya turlari","Backup jarayoni"], ans:1, izoh:"Trigger — DML operatsiya (INSERT, UPDATE, DELETE) sodir bo'lganda avtomatik ishlaydigan saqlangan kod. Ma'lumotlar yaxlitligini tekshirish yoki audit uchun ishlatiladi."},
    {q:"CAP teoremasi nimani anglatadi?", opts:["Consistency, Availability, Performance","Consistency, Availability, Partition tolerance — taqsimlangan tizim uchta xususiyatdan faqat ikkitasini kafolat beradi","Control, Access, Protection","Concurrency, Atomicity, Persistence"], ans:1, izoh:"CAP teoremasi: taqsimlangan tizim Consistency (barcha nodlarda bir xil ma'lumot), Availability (har doim javob beradi) va Partition tolerance (tarmoq bo'linishiga chidamli) dan faqat ikkitasini bir vaqtda ta'minlay oladi."}
  ],
  web: [
    {q:"HTML da semantic tag larning maqsadi nima?", opts:["Dizaynni yaxshilash","Kontent ma'nosini ifoda etish, qidiruvchi motorlar va ekran o'quvchilar uchun tushunarliroq qilish","Sahifani tezlashtirish","JavaScript bilan ishlash"], ans:1, izoh:"Semantic HTML (<header>, <nav>, <main>, <article>, <footer>) teglar — kontent ma'nosini ifodalaydi. SEO uchun muhim va accessibility (ekran o'quvchilar) ni yaxshilaydi."},
    {q:"CSS Box Model da margin, padding, border tartibini to'g'ri ko'rsating:", opts:["Margin > Border > Padding > Content","Border > Margin > Padding > Content","Padding > Border > Margin > Content","Content > Margin > Padding > Border"], ans:0, izoh:"CSS Box Model tashqaridan: Margin (element atrofidagi bo'sh joy) → Border (chegara) → Padding (ichki bo'sh joy) → Content (haqiqiy kontent)."},
    {q:"JavaScript da 'closure' nima?", opts:["Funksiyani yopish","Ichki funksiyaning tashqi funksiya o'zgaruvchilariga kirishini saqlab qolishi","Ob'ektni yaratish","Prototip zanjiri"], ans:1, izoh:"Closure — ichki funksiya tashqi funksiya bajarilib bo'lgandan keyin ham uning o'zgaruvchilarini 'eslaydi'. Bu private state va factory function larni yaratishga imkon beradi."},
    {q:"HTTP va HTTPS ning asosiy farqi nima?", opts:["HTTPS tezroq","HTTPS SSL/TLS bilan ma'lumotlarni shifrlaydi","HTTP yangi protokol","Farq yo'q"], ans:1, izoh:"HTTPS — HTTP + SSL/TLS shifrlash. Ma'lumotlar uchuvchi (man-in-the-middle hujumdan) himoyalanadi. Zamonaviy brauzerlar HTTP ni xavfli deb belgilaydi."},
    {q:"RESTful API da HTTP metodlari qanday ishlatiladi?", opts:["Faqat GET va POST","GET (o'qish), POST (yaratish), PUT (yangilash), DELETE (o'chirish)","Faqat POST","GET va DELETE"], ans:1, izoh:"REST konvensiyasi: GET — ma'lumot olish, POST — yangi yaratish, PUT/PATCH — yangilash, DELETE — o'chirish. Har bir metod ma'lum operatsiya uchun mo'ljallangan."},
    {q:"JavaScript da 'event loop' qanday ishlaydi?", opts:["Parallel threadlarda","Call stack, Web API, Callback Queue — asinxron operatsiyalar boshqaruvi","Faqat sinxron","Operatsion tizim tomonidan"], ans:1, izoh:"JS single-threaded. Event loop: Call Stack bo'sh bo'lganda, Callback Queue dagi funksiyalarni stack ga qo'yadi. setTimeout, fetch, DOM events — Web API tomonidan boshqariladi."},
    {q:"CSS Flexbox da 'justify-content: space-between' nima qiladi?", opts:["Elementlarni markazlashtiradi","Elementlar orasidagi bo'shliqni teng taqsimlaydi, birinchi va oxirgi elementlar chetlarga","Elementlarni stretches qiladi","Elementlarni vertikal joylashtiradi"], ans:1, izoh:"justify-content: space-between — flex elementlar orasidagi bo'shliqni teng taqsimlaydi, birinchi element boshiga, oxirgi element oxiriga yopishib turadi."},
    {q:"DOM (Document Object Model) nima?", opts:["Ma'lumotlar bazasi","HTML hujjatning dasturiy interfeysi — JavaScript bilan boshqarish imkoni","CSS qoidalar to'plami","Brauzer tizimi"], ans:1, izoh:"DOM — HTML hujjatning daraxt strukturasidagi dasturiy ko'rinishi. JavaScript DOM API orqali elementlarni qo'shish, o'zgartirish, o'chirish va hodisalarni boshqarish mumkin."},
    {q:"Asynchronous JavaScript da Promise nima?", opts:["Sinxron funksiya","Kelajakdagi qiymatni ifodalovchi ob'ekt — pending/fulfilled/rejected holatlari bilan","Loop turi","Ma'lumot turi"], ans:1, izoh:"Promise — asinxron operatsiyaning natijasini ifodalaydi. 3 holat: pending (kutilmoqda), fulfilled (muvaffaqiyatli), rejected (xato). .then()/.catch() yoki async/await bilan ishlatiladi."},
    {q:"CSS da 'position: absolute' va 'position: relative' farqi nima?", opts:["Bir xil","relative — o'z normal o'rniga nisbatan, absolute — eng yaqin positioned ajdodiga nisbatan joylashadi","absolute tezroq ishlaydi","relative faqat flexbox da"], ans:1, izoh:"position: relative — elementni normal oqimda qoldiradi, top/left/right/bottom uni shu joyga nisbatan ko'chiradi. position: absolute — normal oqimdan chiqaradi, eng yaqin positioned ajdodga nisbatan joylashadi."},
    {q:"Git da 'merge' va 'rebase' farqi nima?", opts:["Bir xil narsa","merge — birlashtirish tarixi saqlanadi, rebase — tarix chiziqli bo'ladi","rebase xavfliroq","merge yangi fayllar yaratadi"], ans:1, izoh:"Git merge — ikkala branch tarixini saqlab yangi 'merge commit' yaratadi. Git rebase — bir branch commit larini boshqasining ustiga ko'chiradi, tarix chiziqli va toza ko'rinadi."},
    {q:"Web da 'viewport' meta tag nima uchun kerak?", opts:["Faqat mobil uchun","Sahifaning mobil qurilmalardagi o'lchovini boshqarish uchun","JavaScript uchun","Brauzer versiyasi uchun"], ans:1, izoh:"<meta name='viewport' content='width=device-width, initial-scale=1'> — mobil brauzerga sahifa kengligini qurilma kengligi bilan tenglashtiradi. Responsive dizayn uchun zarur."},
    {q:"localStorage va sessionStorage farqi nima?", opts:["Bir xil","localStorage brauzer yopilganda ham saqlanadi, sessionStorage faqat joriy sessiya uchun","localStorage ko'proq hajm","sessionStorage xavfsizroq"], ans:1, izoh:"localStorage — brauzer yopilganda ham ma'lumotlar o'chmaydi (persistent). sessionStorage — tab yoki brauzer yopilganda o'chadi. Ikkisi ham ~5MB ga qadar saqlaydi."},
    {q:"CORS (Cross-Origin Resource Sharing) nima uchun kerak?", opts:["Sahifani tezlashtirish","Brauzerning xavfsizlik siyosatini boshqarish — boshqa domaindan so'rov yuborishga ruxsat berish/rad etish","SSL sertifikati uchun","Cache boshqarish uchun"], ans:1, izoh:"CORS — brauzer xavfsizligi: A.com saytidan B.com API ga so'rov yuborilganda, B.com server CORS headerlar orqali ruxsat berishi yoki rad etishi mumkin."},
    {q:"Web Performance da 'lazy loading' nima?", opts:["Resurslarni oldindan yuklash","Resurslarni (rasm, video) faqat ko'rinish maydoniga kirganda yuklash","Keshdan yuklash","Ma'lumotlarni siqish"], ans:1, izoh:"Lazy loading — rasmlар, video va boshqa resurslarni sahifa ochilganda emas, foydalanuvchi scroll qilib yetib borganida yuklaydi. Bu dastlabki yuklash vaqtini kamaytiradi."},
    {q:"JavaScript da '===' va '==' farqi nima?", opts:["Bir xil","=== qat'iy tenglik (tur va qiymat), == faqat qiymat (tur konversiyasi bilan)","=== faqat raqamlar uchun","== yangi operator"], ans:1, izoh:"=== strict equality: '5' === 5 → false (string vs number). == loose equality: '5' == 5 → true (tur konversiyasi qo'llaniladi). Aksariyat holatlarda === afzalroq."},
    {q:"CSS Grid va Flexbox ning asosiy farqi nima?", opts:["Bir xil narsa","Flexbox bir o'qli (1D), Grid ikki o'qli (2D) layout uchun","Grid yangi, Flexbox eski","Flexbox sahifa uchun, Grid komponent uchun"], ans:1, izoh:"Flexbox — bir yo'nalishda (qator yoki ustun) elementlarni joylashtirishda eng samarali. CSS Grid — ikki o'lchovli (rows + columns) murakkab sahifa layoutlari uchun."},
    {q:"JSON formati nima?", opts:["Dasturlash tili","JavaScript Object Notation — insonlar va mashinalar o'qiy oladigan ma'lumot almashinuv formati","Ma'lumotlar bazasi","Protokol"], ans:1, izoh:"JSON — engil ma'lumot almashish formati. { \"key\": \"value\" } ko'rinishida. REST API lar orqali front-end va back-end o'rtasida ma'lumot uzatishda standart format."},
    {q:"SPA (Single Page Application) va MPA (Multi Page Application) farqi nima?", opts:["Bir xil narsa","SPA bir sahifada dinamik kontent yuklaydi, MPA har sahifa o'tishida yangi HTML yuklanadi","SPA sekinroq","MPA zamonaviyroq"], ans:1, izoh:"SPA (React, Vue, Angular) — bir HTML fayli, kontent JavaScript bilan dinamik yuklanadi, sahifa yangilanmaydi. MPA — har o'tishda server yangi HTML yuboradi. SPA UX yaxshi, MPA SEO yaxshi."},
    {q:"Web Security da XSS (Cross-Site Scripting) nima?", opts:["Serverni buzish","Hujumchi zararli JavaScript ni saytga kiritib, foydalanuvchi brauzerida ijro etishi","Parolni buzish","DDOS hujumi"], ans:1, izoh:"XSS — hujumchi zararli skriptni sahifaga kiritadi (input orqali). Boshqa foydalanuvchi sahifani ochganda, skript ularning brauzerida ijro etiladi — cookie o'g'irlash, phishing uchun ishlatiladi."}
  ]
};

// ═══════════════════════════════════════════════
// SESIYA — QO'SHIMCHA 10 SAVOL (har bir fanda)
// TEST (20) + QO'SHIMCHA (10) = SESIYA (30 ta)
// ═══════════════════════════════════════════════
var REAL_EXTRA_QUESTIONS = {
  algo: [
    {q:"Topological sort qaysi turdagi graflarda ishlaydi?", opts:["Yo'naltirilmagan graflar","Yo'naltirilgan asiklik graflar (DAG)","Og'irli graflar","Har qanday graflar"], ans:1, izoh:"Topological sort faqat DAG (Directed Acyclic Graph) larda ishlaydi. Tsikli grafda topologik tartib mavjud emas, chunki hech bir vertex boshqasidan oldin kela olmaydi."},
    {q:"Amortized analysis nima uchun kerak?", opts:["Eng yomon holni hisoblash","Ko'p operatsiyalar uchun o'rtacha narxni hisoblash","Faqat yaxshi holni hisoblash","Xotira sarfini hisoblash"], ans:1, izoh:"Amortized analysis — ko'plab operatsiyalarning umumiy narxini operatsiyalar soniga bo'lib topadi. Dynamic array push() O(1) amortized, chunki resizing kamdan-kam bo'ladi."},
    {q:"Two-pointer texnikasi qaysi muammolar uchun eng samarali?", opts:["Graf qidirish","Tartiblangan arrayda ikkita element yig'indisi/muammosi","Rekursiv muammolar","Graf daraxtlari"], ans:1, izoh:"Two-pointer (ikkita ko'rsatkich) texnikasi tartiblangan arrayda, pallindrom tekshirishda, oyna harakatida O(n²) dan O(n) ga tushiradi."},
    {q:"Bellman-Ford va Dijkstra algoritmining asosiy farqi nima?", opts:["Bellman-Ford tezroq","Bellman-Ford manfiy og'irlikli qirralarni ham qayta ishlaydi","Dijkstra barcha graflar uchun","Farq yo'q"], ans:1, izoh:"Dijkstra faqat musbat og'irliklar uchun. Bellman-Ford manfiy og'irliklar bilan ham ishlaydi va manfiy tsiklni aniqlaydi, lekin O(VE) murakkablikka ega."},
    {q:"Segment Tree ma'lumotlar tuzilmasi nima uchun ishlatiladi?", opts:["Tartiblash uchun","Diapazon so'rovlari (sum, min, max) ni O(log n) da qayta ishlash uchun","Graflarni saqlash uchun","Tasodifiy qidirish uchun"], ans:1, izoh:"Segment Tree — massivning qismlarida (diapazon) sum, min, max, gcd kabi so'rovlarni O(log n) da bajaradi. O'zgartirish ham O(log n)."},
    {q:"Trie (Prefix Tree) ma'lumotlar tuzilmasi nima uchun eng ko'p ishlatiladi?", opts:["Sonlarni tartiblash","Matnli ma'lumotlarda prefiks qidirish va autocomplete","Graf algoritmlari","Ikkilik qidirish"], ans:1, izoh:"Trie — so'zlarni harf-harf saqlaydi. Prefiks bo'yicha qidirish O(m), m — so'z uzunligi. Autocomplete, spell checker, IP routing uchun ishlatiladi."},
    {q:"0/1 Knapsack muammosi Dynamic Programming bilan O(?) murakkablikda yechiladi?", opts:["O(n)","O(n log n)","O(nW) — n element, W kapasitet","O(2^n)"], ans:2, izoh:"0/1 Knapsack DP bilan O(nW) — n ta element, W kapasitet. 2D DP jadvali quriladi: dp[i][w] = i-element bilan w kapasitetda maksimal qiymat."},
    {q:"Floyd-Warshall algoritmi nima hisoblaydi?", opts:["Faqat bitta manba shortest path","Barcha juft vertexlar orasidagi eng qisqa yo'l","Minimum spanning tree","Graf tsikllarini topish"], ans:1, izoh:"Floyd-Warshall — barcha juft (i,j) vertexlar orasidagi eng qisqa yo'lni O(V³) da hisoblaydi. Manfiy og'irliklar bilan ham ishlaydi."},
    {q:"Iterative deepening DFS (IDDFS) nima ustunlikka ega?", opts:["BFS dan tezroq","DFS ning kam xotira sarfi + BFS ning to'liqlik kafolati","Kamroq vaqt sarfi","Faqat daraxtlarda ishlaydi"], ans:1, izoh:"IDDFS — DFS kabi kam xotira (O(d)) sarflaydi, lekin BFS kabi eng qisqa yo'lni kafolatlaydi. Chuqurlik limiti sekin oshirib boriladi."},
    {q:"Space complexity: rekursiv DFS vs iterativ DFS qanday farqlanadi?", opts:["Bir xil","Rekursiv O(h) call stack, iterativ O(h) explicit stack — ikkalasi ham O(h)","Rekursiv O(1)","Iterativ O(n²)"], ans:1, izoh:"Rekursiv DFS — call stack da O(h) (h = daraxt balandligi) joy oladi. Iterativ DFS — explicit stack da O(h) joy oladi. Ikkalasi asimptotik bir xil, lekin rekursiv stack overflow xavfi ko'proq."}
  ],
  ai: [
    {q:"Encoder-decoder arxitekturasi qaysi vazifa uchun mo'ljallangan?", opts:["Ikkilik klassifikatsiya","Ketma-ketlikdan ketma-ketlikka (seq2seq): tarjima, xulosa","Klasterlash","Rasm klassifikatsiyasi"], ans:1, izoh:"Encoder-decoder (seq2seq) arxitekturasi kirish ketma-ketligini qisqartirib (encode), keyin yangi ketma-ketlik hosil qiladi (decode). Tarjima, matn xulosa, chatbot uchun."},
    {q:"L1 va L2 regularization farqi nima?", opts:["Bir xil narsa","L1 (Lasso) — siyrak weights, L2 (Ridge) — kichik weights, L1 ba'zi weightlarni nolga tushiradi","L2 tezroq","L1 faqat chiziqli modellarda"], ans:1, izoh:"L1 regularization ba'zi vazn (weight) larni to'liq nolga aylantiradi — bu feature selection vazifasini bajaradi. L2 barcha vazn larni kichraytiradi, lekin nolga tushirmaydi."},
    {q:"Batch size kichik bo'lganda nima bo'ladi?", opts:["Model tezroq yaqinlashadi","Gradient noisier bo'ladi, katta batch size ga nisbatan regularizatsiya effekti beradi","Model o'qimaydi","Ko'proq xotira kerak bo'ladi"], ans:1, izoh:"Kichik batch — noisier gradient, lekin regularizatsiya effekti beradi va local minimumdan chiqishga yordam beradi. Katta batch — aniqroq gradient, lekin katta xotira talab qiladi."},
    {q:"Word2Vec nima?", opts:["So'zlarni tartiblash algoritmi","So'zlarni real vektorial ko'rinishda ifodalovchi embedding modeli","Matn klassifikatori","Grammatika tekshiruvchi"], ans:1, izoh:"Word2Vec — so'zlarni yuqori o'lchovli vektor fazosiga joylaydi, bunda ma'nodosh so'zlar geometrik jihatdan yaqin bo'ladi. Skip-gram va CBOW arxitekturalari mavjud."},
    {q:"GAN (Generative Adversarial Network) da generator va discriminator nima qiladi?", opts:["Ikkisi ham bir vazifa","Generator soxta ma'lumot yaratadi, discriminator haqiqiy/soxta ajratadi","Generator klassifikatsiya qiladi","Discriminator ma'lumot yaratadi"], ans:1, izoh:"Generator — discriminatorni aldaydigan haqiqiydek soxta ma'lumot yaratadi. Discriminator — haqiqiy/soxta ajratishni o'rganadi. Ikkovlashin raqobati natijasida generator mukammallashadi."},
    {q:"Autoencoder nima uchun ishlatiladi?", opts:["Klassifikatsiya uchun","Dimensionality reduction, denoising, anomaly detection uchun","Regressiya uchun","Reinforcement learning uchun"], ans:1, izoh:"Autoencoder — kirish ma'lumotini kichik latent fazoga kodlab (encode), keyin qayta tiklaydi (decode). Siqish, shovqinni tozalash, anomaliya topishda ishlatiladi."},
    {q:"Learning rate juda katta bo'lsa nima bo'ladi?", opts:["Model tezroq o'rganadi","Model yaqinlashmaydi — loss oscillate yoki diverge bo'ladi","Overfitting ko'payadi","Hech nima o'zgarmaydi"], ans:1, izoh:"Katta learning rate — gradient descent minimum atrofida sakrashda davom etadi (oscillate) yoki loss ortib ketadi (diverge). Kichik learning rate esa juda sekin yaqinlashadi."},
    {q:"Semantic segmentation nima?", opts:["Rasmni ikkilik ajratish","Rasmning har bir pikselini ma'lum bir sinfga tegishli deb belgilash","Ob'ekt koordinatalarini topish","Rasmni klassifikatsiya qilish"], ans:1, izoh:"Semantic segmentation — rasmning har bir pikseliga sinf yorlig'i beradi (ko'cha, mashina, piyoda). Object detection faqat bounding box beradi, segmentation esa piksel darajasida ishlaydi."},
    {q:"Hyperparameter tuning da Random Search vs Grid Search farqi nima?", opts:["Bir xil","Random Search tasodifiy kombinatsiyalar sinaydi, Grid Search barcha kombinatsiyalarni", "Grid Search tezroq","Random Search har doim yaxshiroq"], ans:1, izoh:"Grid Search — barcha parametr kombinatsiyalarini tekshiradi (O(n^k) vaqt). Random Search — tasodifiy kombinatsiyalar sinaydi va ko'pincha tezroq yaxshi natija beradi, ayniqsa ko'p parametr bo'lsa."},
    {q:"BERT va GPT arxitekturasining asosiy farqi nima?", opts:["Bir xil narsa","BERT — bidirectional (ikki tomonlama) encoder, GPT — unidirectional (chap→o'ng) decoder","BERT generativ, GPT klassifikator","BERT kattaroq"], ans:1, izoh:"BERT — kontekstni ikki tomondan (chap va o'ng) ko'radi, shuning uchun tushunish (classification, QA) ga yaxshi. GPT — faqat chap kontekstni ko'radi, shuning uchun matn generatsiyasiga yaxshi."}
  ],
  math: [
    {q:"Jacobian matritsa nima?", opts:["Matritsa ko'paytmasi","Ko'p o'zgaruvchili funksiyaning barcha qisman hosilalaridan tashkil topgan matritsa","Matritsa teskari","Eigenvalue matritsa"], ans:1, izoh:"Jacobian J — vektorial funksiyaning barcha birinchi tartibli qisman hosilalari matritsasi. Backpropagation, Newton metodi, koordinat transformatsiyasi uchun muhim."},
    {q:"Shannon entropiyasi nima uchun kerak?", opts:["Ma'lumot siqish uchun faqat","Ma'lumot belirsizligi yoki axborot miqdorini o'lchash uchun","Matritsa hisoblash uchun","Vaqt murakkabligini hisoblash uchun"], ans:1, izoh:"Shannon entropiyasi H(X) = -Σ p(x) log p(x) — tasodifiy o'zgaruvchining belirsizligi yoki axborot miqdorini o'lchaydi. Cross-entropy loss ML da entropiya asosida qurilgan."},
    {q:"KL divergence (Kullback-Leibler) nima o'lchaydi?", opts:["Ikkita sonning farqi","Ikki ehtimollik taqsimoti orasidagi farqni o'lchaydi","Matritsa determinanti","Gradient yo'nalishi"], ans:1, izoh:"KL(P||Q) — P taqsimotdan Q ga nisbatan qanchalik ma'lumot yo'qolishini o'lchaydi. Variational autoencoders, information theory da keng ishlatiladi. Simmetrik emas: KL(P||Q) ≠ KL(Q||P)."},
    {q:"Markov zanjiri (Markov Chain) asosiy xususiyati nima?", opts:["Barcha o'tgan holatlarga bog'liq","Keyingi holat faqat joriy holatga bog'liq, o'tgan holatlarga bog'liq emas (Markov property)","Deterministik sistema","Ehtimollik yo'q"], ans:1, izoh:"Markov property — kelajak faqat hozirgi holat bilan aniqlanadi, tarix muhim emas. P(Xn+1|Xn, Xn-1,..., X0) = P(Xn+1|Xn). Reinforcement learning, NLP da ishlatiladi."},
    {q:"Merkez limit teoremasi (Central Limit Theorem) nima deydi?", opts:["Katta sonlar qonuni","Ixtiyoriy taqsimotdan olingan katta miqdordagi namunalar yig'indisi normal taqsimotga yaqinlashadi","Barcha ma'lumotlar normal taqsimotda","Faqat diskret ma'lumotlar uchun"], ans:1, izoh:"CLT — ixtiyoriy taqsimotda n katta bo'lganda, namunalar o'rtachasi normal taqsimotga yaqinlashadi. Bu statistika va ML da keng qo'llaniladigan fundamental teoreма."},
    {q:"Kovariansiya matritsasi (Covariance matrix) nima ko'rsatadi?", opts:["O'zgaruvchilarning o'rtacha qiymatlari","O'zgaruvchilar orasidagi chiziqli bog'liqliklarni","Taqsimotning o'rtacha qiymati","Determinanti"], ans:1, izoh:"Kovariansiya matritsasi Σ — d o'zgaruvchili ma'lumot uchun barcha juft o'zgaruvchilar orasidagi kovariansiyalarni saqlaydi. PCA, Gaussian distribution, Kalman filter da asosiy rol o'ynaydi."},
    {q:"Singular Value Decomposition (SVD) nima?", opts:["Matritsa determinanti","A = UΣV^T ko'rinishida matritsani uchta maxsus matritsa ko'paytmasiga ajratish","Matritsani inverslashtirish","Matritsani qo'shish"], ans:1, izoh:"SVD — ixtiyoriy matritsani A = UΣV^T ko'rinishda faktorizatsiya qiladi. PCA, recommendation systems (matrits faktorizatsiya), pseudo-inverse hisoblashda ishlatiladi."},
    {q:"Katta sonlar qonuni (Law of Large Numbers) nima deydi?", opts:["Katta sonlar murakkab","Namuna soni ortishi bilan namuna o'rtachasi haqiqiy o'rtachaga yaqinlashadi","Hamma sonlar teng","Tasodifiylik ortadi"], ans:1, izoh:"Katta sonlar qonuni — n→∞ da namuna o'rtachasi μ ga yaqinlashadi. Bu Monte Carlo simulatsiya, statistik taxmin, ML modellarning asosiy nazariy asosi."},
    {q:"Fourier transform nima uchun kerak?", opts:["Sonlarni tartiblash","Signalni vaqt domenidan chastota domeniga o'tkazish","Matritsa ko'paytirish","Gradient hisoblash"], ans:1, izoh:"Fourier transform — signalning tarkibiy chastotalarini topadi. Audio qayta ishlash, rasm siqish (JPEG), signal filtrlash, ba'zi ML modellarida ishlatiladi."},
    {q:"Beta taqsimoti qayerda ishlatiladi?", opts:["Diskret ma'lumotlar uchun","Ehtimollik o'zi ehtimollik sifatida ko'rilganda (Bayesian inference)","Faqat binomial taqsimot uchun","Normal taqsimot o'rnida"], ans:1, izoh:"Beta(α,β) taqsimoti [0,1] oralig'ida. Bayesian statistikada binomial taqsimot uchun prior sifatida ishlatiladi (Beta-Binomial conjugate pair). Click-through rate, conversion rate modellashtirish uchun qulay."}
  ],
  db: [
    {q:"EXPLAIN buyrugi SQL da nima uchun ishlatiladi?", opts:["Jadval yaratish uchun","So'rov bajarish rejasini (query plan) ko'rish va optimallash uchun","Jadval o'chirish uchun","Trigger yaratish uchun"], ans:1, izoh:"EXPLAIN — SQL so'rovining qanday bajarilishini ko'rsatadi: qaysi indeks ishlatilayotgani, join algoritmi, qator soni taxmini. Sekin so'rovlarni optimallashtirishda asosiy vosita."},
    {q:"Full-text search va LIKE operatori farqi nima?", opts:["Bir xil narsa","Full-text search inverted index ishlatadi va relevanlik bo'yicha tartiblaydi, LIKE esa simple pattern matching","LIKE tezroq","Full-text faqat bitta so'z uchun"], ans:1, izoh:"LIKE '%matn%' — to'liq table scan (O(n)), indeks ishlatmaydi. Full-text search (MATCH...AGAINST) — inverted index bilan O(log n), relevance ranking, stemming qo'llab-quvvatlaydi."},
    {q:"Connection pooling nima uchun kerak?", opts:["Ma'lumotlarni siqish uchun","Ma'lumotlar bazasiga yangi ulanish yaratish xarajatini tejash uchun ko'p marta qayta ishlatish","Tranzaksiyalarni boshqarish uchun","Indeks yaratish uchun"], ans:1, izoh:"Har safar yangi DB ulanish yaratish vaqt va resurs talab qiladi. Connection pool — oldindan yaratilgan ulanishlar to'plami. So'rov kelganda mavjud ulanish olinadi va qaytarilganda pool ga qaytariladi."},
    {q:"Optimistik va pessimistik bloklash (locking) farqi nima?", opts:["Bir xil narsa","Pessimistik — o'qishda ham bloklaydi, Optimistik — yozishda versiya tekshiradi","Optimistik tezroq har doim","Pessimistik faqat NoSQL da"], ans:1, izoh:"Pessimistik locking — to'qnashuv bo'ladi deb hisoblab darhol bloklaydi (SELECT...FOR UPDATE). Optimistik locking — to'qnashuv kam deb hisoblab, versiya/timestamp bilan yozishda tekshiradi."},
    {q:"Partitioning va Sharding farqi nima?", opts:["Bir xil narsa","Partitioning — bitta serverda mantiqiy bo'lish, Sharding — turli serverlarga gorizontal taqsimlash","Partitioning tashqi, Sharding ichki","Sharding vertikal"], ans:1, izoh:"Partitioning — bitta server ichida jadval ma'lumotlarini mantiqiy bo'laklarga ajratish (range, list, hash). Sharding — ma'lumotlarni bir nechta fizik serverlarga taqsimlash (gorizontal scale-out)."},
    {q:"Materialized View va oddiy View farqi nima?", opts:["Bir xil narsa","Materialized View natijalarni fizik saqlaydi, oddiy View faqat so'rov hisoblanadi","Materialized View yangi jadval","View ko'proq xotira"], ans:1, izoh:"View — har safar chaqirilganda so'rov bajariladi. Materialized View — natijalar fizik saqlanadi va vaqti-vaqti bilan yangilanadi. O'qish juda tez, lekin xotira sarfi ko'proq."},
    {q:"Event Sourcing pattern nima?", opts:["Faqat joriy holatni saqlash","Tizim holatini o'zgarishlar ro'yxati (event log) sifatida saqlash","Faqat oxirgi o'zgarishni saqlash","Tarqatilgan tranzaksiya"], ans:1, izoh:"Event Sourcing — tizim holati o'zgarishlar ketma-ketligi sifatida saqlanadi. Joriy holat barcha event larni qayta o'ynatish orqali tiklanadi. Audit trail, time travel, CQRS bilan ishlatiladi."},
    {q:"Two-Phase Commit (2PC) nima uchun kerak?", opts:["Bitta serverda tranzaksiya uchun","Taqsimlangan tranzaksiyalarda barcha nodalarda atomiklikni ta'minlash uchun","Replikatsiya uchun","Index optimallashtirish uchun"], ans:1, izoh:"2PC — taqsimlangan sistemada bir nechta serverda tranzaksiya: 1-faza: barcha nodlar 'tayyor' deydi, 2-faza: koordinator commit yoki rollback buyuradi. Atomiklikni kafolatlaydi."},
    {q:"Graph database qaysi hollarda relyatsion MB dan afzal?", opts:["Har doim afzal","Ko'p darajali bog'liqliklarni tez traversal qilishda (ijtimoiy tarmoq, yo'l topish)","Faqat kichik ma'lumotlar uchun","Faqat NoSQL deb ataladigan hollarda"], ans:1, izoh:"Graph DB (Neo4j, Amazon Neptune) — tugunlar va qirralar orqali murakkab bog'liqliklarni O(1) da traversal qiladi. Ijtimoiy tarmoqlar, recommendation engine, fraud detection uchun optimal."},
    {q:"MVCC (Multi-Version Concurrency Control) qanday ishlaydi?", opts:["Faqat bitta versiyani saqlaydi","Har bir yozishda yangi versiya yaratadi, o'qish eski versiyani ko'radi — lock yo'q","Barcha tranzaksiyalarni kutadi","Faqat PostgreSQL da"], ans:1, izoh:"MVCC — yozuvchi o'quvchini, o'quvchi yozuvchini bloklamaydi. Har bir tranzaksiya ma'lumotning o'z momentidagi snapshottini ko'radi. PostgreSQL, Oracle MVCC dan foydalanadi."}
  ],
  web: [
    {q:"Service Worker nima va nima uchun kerak?", opts:["CSS fayli","Brauzer va tarmoq orasida ishlaydigan proksi — offline ishlash, push notifications uchun","JavaScript framework","Server texnologiyasi"], ans:1, izoh:"Service Worker — fon da ishlaydigan JS skript. Tarmoq so'rovlarini ushlab qoladi (cache), offline rejimni, background sync va push notifications ni ta'minlaydi. PWA (Progressive Web App) asosi."},
    {q:"WebSocket va Server-Sent Events (SSE) farqi nima?", opts:["Bir xil narsa","WebSocket ikki tomonlama real-time, SSE faqat server→client bir tomonlama","SSE tezroq","WebSocket faqat chat uchun"], ans:1, izoh:"WebSocket — to'liq duplex (ikki tomonlama) real-time aloqa (chat, multiplayer o'yin). SSE — server→client bir tomonlama stream (yangiliklar lentasi, live updates). SSE simpleiroq, HTTP orqali ishlaydi."},
    {q:"Tree shaking JavaScript da nima?", opts:["DOM ni tozalash","Foydalanilmagan kod (dead code) ni bundle dan olib tashlash","Daraxt tuzilmasini saqlash","CSS tozalash"], ans:1, izoh:"Tree shaking — ES modules static import/export tahlili orqali foydalanilmagan kodni bundle dan chiqarib tashlaydi. Webpack, Rollup, Vite qo'llab-quvvatlaydi. Bundle hajmini kamaytiradi."},
    {q:"Virtual DOM nima va nima uchun kerak?", opts:["Brauzerning DOM dan ko'chirma","Real DOM ning JS ob'ektidagi yengil nusxasi — DOM yangilanishlarini optimallashtirish uchun","Server tomonida ishlaydi","CSS abstraktsiyasi"], ans:1, izoh:"Virtual DOM (React, Vue) — real DOM o'zgarishlarini to'g'ridan-to'g'ri qilish o'rniga, virtual nusxada solishtiradi (diffing) va faqat o'zgargan qismlarni yangilaydi. DOM operatsiyalari qimmat bo'lgani uchun samarali."},
    {q:"Content Security Policy (CSP) nima qiladi?", opts:["Kontent siqadi","XSS hujumlariga qarshi — qaysi manbalardan skript, rasm, stil yuklanishiga ruxsat beradi","CORS bilan bir xil","Faqat parollarni himoya qiladi"], ans:1, izoh:"CSP — HTTP header yoki meta tag orqali brauzerga qaysi domenlardan resurs (JS, CSS, rasm) yuklanishga ruxsat berilishini bildiradi. XSS hujumlarini katta darajada kamaytiradi."},
    {q:"HTTP/2 ning HTTP/1.1 dan asosiy ustunligi nima?", opts:["Xavfsizroq","Multiplexing — bitta ulanishda parallel so'rovlar, header kompressiya, server push","Yangi protokol","Tezroq DNS"], ans:1, izoh:"HTTP/2 — bitta TCP ulanishda bir nechta so'rovni parallel yuboradi (multiplexing). HTTP/1.1 da har so'rov uchun yangi ulanish kerak edi (yoki HOL blocking muammosi). Header compression ham qo'shildi."},
    {q:"OAuth 2.0 qanday ishlaydi (asosiy oqim)?", opts:["Foydalanuvchi parolini uchinchi tomonga beradi","Foydalanuvchi autorizatsiya serverida kiradi, access token oladi — parol emas, token ishlatiladi","Faqat API kalitlari","Parolni shifrlaydi"], ans:1, izoh:"OAuth 2.0 — resource owner (foydalanuvchi) → authorization server → access token. Uchinchi tomon ilovalar foydalanuvchi paroliga kirmasdan, faqat ruxsat berilgan resurslardan foydalana oladi."},
    {q:"WebAssembly (WASM) nima va qachon ishlatiladi?", opts:["JavaScript uchun yangi sintaksis","Brauzerda near-native tezlikda bajariladigan binary format — CPU-intensive vazifalar uchun","CSS preprocessor","Yangi HTML standart"], ans:1, izoh:"WebAssembly — C/C++/Rust kabi tillarni brauzerda near-native tezlikda bajarish imkonini beradi. 3D o'yinlar, video/audio encoding, kriptografiya, CAD vositalar uchun ishlatiladi."},
    {q:"Micro-frontends arxitekturasi nima?", opts:["CSS micro animatsiyalar","Katta frontend ilovani kichik, mustaqil, alohida deploy qilinadigan qismlarga bo'lish","Bitta komponent qilish","Mobile arxitektura"], ans:1, izoh:"Micro-frontends — backend microservices g'oyasini frontendga ko'chirish. Har bir jamoa mustaqil ravishda o'z qismini ishlab chiqadi va deploy qiladi. Module Federation (Webpack 5) keng ishlatiladi."},
    {q:"Progressive Enhancement va Graceful Degradation farqi nima?", opts:["Bir xil narsa","Progressive Enhancement — asosiy funksionallikdan boshlab, imkoniyatlar qo'shiladi; Graceful Degradation — to'liq funksionallikdan boshlab, eski brauzerlarda soddalashadi","Faqat mobile dizayn","CSS metodologiyasi"], ans:1, izoh:"Progressive Enhancement — avval barcha brauzerlarda ishlaydigan asosiy versiya, keyin zamonaviy xususiyatlar qo'shiladi. Graceful Degradation — zamonaviy versiyadan boshlanib, eski muhitlar uchun osonlashtiriladi."}
  ]
};

function getRealQuestions(subj) {
  var base = TEST_QUESTIONS_DB[subj] || [];
  var extra = REAL_EXTRA_QUESTIONS[subj] || [];
  return base.concat(extra);
}

var _currentRealSubject = null;
var _currentRealQuestions = [];
var _realAnswers = {};

var _currentTestSubject = null;
var _currentTestQuestions = [];
var _testAnswers = {};
var _testTimer = null, _realTimer = null;
var _testSec = 30*60, _realSec = 90*60;

function setSesiyaState(type, active) {
  SESIYA_STATE[type] = active;
  var now = new Date();
  var timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  var label = type === 'test' ? 'Test Rejim' : 'Sesiya';
  var action = active ? 'faollashtirildi' : 'bloklandi';
  var emoji = active ? '✅' : '🔒';
  // Update log
  var log = document.getElementById('sesiyaLog');
  if (log) {
    var oldEmpty = log.querySelector('[style*="text-align:center"]');
    if (oldEmpty) oldEmpty.remove();
    var entry = document.createElement('div');
    entry.style.cssText = 'padding:10px 14px;background:' + (active ? '#DCFCE7' : '#FEE2E2') + ';border-radius:9px;border:1px solid ' + (active ? '#86EFAC' : '#FCA5A5') + ';font-size:13px;color:#0F172A;display:flex;align-items:center;gap:10px';
    entry.innerHTML = '<span style="font-size:16px">' + emoji + '</span><span><strong>' + label + '</strong> ' + action + '</span><span style="margin-left:auto;color:#94A3B8;font-size:11px;font-family:monospace">' + timeStr + '</span>';
    log.insertBefore(entry, log.firstChild);
  }
  // Update card UI
  if (type === 'test') {
    var badge = document.getElementById('testStatusBadge');
    var btnU = document.getElementById('btnUnlockTest');
    var btnL = document.getElementById('btnLockTest');
    var card = document.getElementById('cardTestMode');
    if (badge) { badge.textContent = active ? '✅ Faol' : '🔒 Qulflangan'; badge.style.background = active ? '#DCFCE7' : '#FEF3C7'; badge.style.color = active ? '#16A34A' : '#D97706'; }
    if (btnU) btnU.style.display = active ? 'none' : '';
    if (btnL) btnL.style.display = active ? '' : 'none';
    if (card) card.style.borderColor = active ? '#86EFAC' : '#E2E8F0';
  } else {
    var badge2 = document.getElementById('realStatusBadge');
    var btnU2 = document.getElementById('btnUnlockReal');
    var btnL2 = document.getElementById('btnLockReal');
    var card2 = document.getElementById('cardRealMode');
    if (badge2) { badge2.textContent = active ? '🟢 Faol' : '🔒 Qulflangan'; badge2.style.background = active ? '#DCFCE7' : '#FEF3C7'; badge2.style.color = active ? '#16A34A' : '#D97706'; }
    if (btnU2) btnU2.style.display = active ? 'none' : '';
    if (btnL2) btnL2.style.display = active ? '' : 'none';
    if (card2) card2.style.borderColor = active ? '#FCA5A5' : '#E2E8F0';
  }
  showToast(emoji, label, active ? 'Talabalar uchun faollashtirildi!' : 'Qulflandi. Talabalar kira olmaydi.', active ? 'green' : 'red');
}

function renderSesiyaTest() {
  var locked = document.getElementById('stest-locked');
  var instr = document.getElementById('stest-instructions');
  var active = document.getElementById('stest-active');
  var results = document.getElementById('stest-results');
  if (!locked) return;
  if (SESIYA_STATE.test) {
    locked.style.display = 'none';
    active.style.display = 'none';
    results.style.display = 'none';
    instr.style.display = 'block';
    document.getElementById('testPageSub').textContent = 'Fan tanlang va testni boshlang';
  } else {
    locked.style.display = 'flex';
    instr.style.display = 'none';
    active.style.display = 'none';
    results.style.display = 'none';
    if (_testTimer) { clearInterval(_testTimer); _testTimer = null; }
  }
}

function showTestInstructions() {
  if (_testTimer) { clearInterval(_testTimer); _testTimer = null; }
  _testAnswers = {};
  document.getElementById('stest-instructions').style.display = 'block';
  document.getElementById('stest-active').style.display = 'none';
  document.getElementById('stest-results').style.display = 'none';
  document.getElementById('testPageSub').textContent = 'Fan tanlang va testni boshlang';
}

function startTestWithSubject(subj) {
  _currentTestSubject = subj;
  _currentTestQuestions = TEST_QUESTIONS_DB[subj] || [];
  _testAnswers = {};

  var icons = {algo:'💻', ai:'🤖', math:'📐', db:'🗄️', web:'🌐'};
  var names = {algo:'Algoritmlar va Dasturlash', ai:"Sun'iy Intellekt", math:'Matematika (AI uchun)', db:"Ma'lumotlar Bazasi", web:'Web Dasturlash'};

  document.getElementById('testSubjectIcon').textContent = icons[subj] || '📝';
  document.getElementById('testSubjectName').textContent = names[subj] || subj;
  document.getElementById('testProgressLabel').textContent = '0/' + _currentTestQuestions.length;
  document.getElementById('testProgressBar').style.width = '0%';
  document.getElementById('testPageSub').textContent = names[subj] + ' · Mashq rejim';

  // Render questions
  var container = document.getElementById('testQuestionsContainer');
  var html = '';
  _currentTestQuestions.forEach(function(q, i) {
    html += '<div id="tq-' + i + '" style="background:white;border:1.5px solid #E2E8F0;border-radius:12px;padding:18px 20px;margin-bottom:14px;transition:border-color 0.2s">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">';
    html += '<div style="font-size:13.5px;font-weight:700;color:#0F172A;line-height:1.5"><span style="color:#94A3B8;margin-right:6px">' + (i+1) + '.</span>' + q.q + '</div>';
    html += '<button onclick="toggleEtirozBox(' + i + ')" style="white-space:nowrap;padding:4px 10px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:6px;font-size:11px;font-weight:600;color:#EA580C;cursor:pointer;font-family:\'Outfit\',sans-serif">⚠️ E\'tiroz</button>';
    html += '</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    q.opts.forEach(function(opt, j) {
      html += '<label id="tq-' + i + '-opt-' + j + '" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;cursor:pointer;font-size:13px;transition:all 0.15s" onmouseover="this.style.borderColor=\'#1B4FD8\';this.style.background=\'#F8FBFF\'" onmouseout="this.style.borderColor=(document.getElementById(\'tq'+i+'ans\').value===\''+j+'\'?\'#1B4FD8\':\'#E2E8F0\');this.style.background=(document.getElementById(\'tq'+i+'ans\').value===\''+j+'\'?\'#EEF3FF\':\'white\')">';
      html += '<input type="radio" name="tq' + i + '" value="' + j + '" style="accent-color:#1B4FD8;width:16px;height:16px" onchange="onTestAnswer(' + i + ',' + j + ')"> ' + opt;
      html += '</label>';
    });
    html += '</div>';
    html += '<input type="hidden" id="tq' + i + 'ans" value="">';
    // E'tiroz box
    html += '<div id="etirozBox' + i + '" style="display:none;margin-top:12px;background:#FFF7ED;border:1.5px solid #FED7AA;border-radius:10px;padding:14px">';
    html += '<div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:8px">⚠️ ' + (i+1) + '-savol bo\'yicha e\'tiroz:</div>';
    html += '<textarea id="etirozText' + i + '" placeholder="E\'tirozingiz sababini yozing..." style="width:100%;padding:10px;border:1.5px solid #FED7AA;border-radius:8px;font-family:\'Outfit\',sans-serif;font-size:13px;resize:vertical;min-height:70px;outline:none;box-sizing:border-box"></textarea>';
    html += '<div style="display:flex;gap:8px;margin-top:8px">';
    html += '<button onclick="submitEtiraz(' + i + ')" style="padding:7px 16px;background:#EA580C;color:white;border:none;border-radius:7px;font-family:\'Outfit\',sans-serif;font-size:12.5px;font-weight:700;cursor:pointer">📤 Dekanatga yuborish</button>';
    html += '<button onclick="document.getElementById(\'etirozBox' + i + '\').style.display=\'none\'" style="padding:7px 14px;background:white;border:1.5px solid #E2E8F0;border-radius:7px;font-family:\'Outfit\',sans-serif;font-size:12.5px;cursor:pointer">Bekor</button>';
    html += '</div></div>';
    html += '</div>';
  });
  container.innerHTML = html;

  // Show active, hide instructions
  document.getElementById('stest-instructions').style.display = 'none';
  document.getElementById('stest-active').style.display = 'block';
  document.getElementById('stest-results').style.display = 'none';

  // Start timer
  if (_testTimer) clearInterval(_testTimer);
  _testSec = 30 * 60;
  document.getElementById('testTimerDisplay').textContent = '30:00';
  _testTimer = setInterval(function() {
    _testSec--;
    var m = Math.floor(_testSec/60).toString().padStart(2,'0');
    var s = (_testSec%60).toString().padStart(2,'0');
    var el = document.getElementById('testTimerDisplay');
    if (el) {
      el.textContent = m + ':' + s;
      el.style.color = _testSec < 300 ? '#DC2626' : '#1B4FD8';
    }
    if (_testSec <= 0) { clearInterval(_testTimer); _testTimer = null; submitTestExam(); }
  }, 1000);

  window.scrollTo({top: 0, behavior: 'smooth'});
}

function onTestAnswer(qi, optIdx) {
  _testAnswers[qi] = optIdx;
  var hidden = document.getElementById('tq' + qi + 'ans');
  if (hidden) hidden.value = optIdx;
  // Style the selected option
  var qs = TEST_QUESTIONS_DB[_currentTestSubject][qi];
  qs.opts.forEach(function(_, j) {
    var lbl = document.getElementById('tq-' + qi + '-opt-' + j);
    if (lbl) {
      lbl.style.borderColor = j === optIdx ? '#1B4FD8' : '#E2E8F0';
      lbl.style.background = j === optIdx ? '#EEF3FF' : 'white';
    }
  });
  // Mark question card
  var card = document.getElementById('tq-' + qi);
  if (card) card.style.borderColor = '#86EFAC';
  // Update answered count and progress
  var answered = Object.keys(_testAnswers).length;
  var total = _currentTestQuestions.length;
  var pct = Math.round(answered / total * 100);
  var pb = document.getElementById('testProgressBar');
  if (pb) pb.style.width = pct + '%';
  var pl = document.getElementById('testProgressLabel');
  if (pl) pl.textContent = answered + '/' + total;
  var ac = document.getElementById('testAnsweredCount');
  if (ac) ac.textContent = answered + ' ta savol javob berildi';
}

function toggleEtirozBox(qi) {
  var box = document.getElementById('etirozBox' + qi);
  if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function submitEtiraz(qi) {
  var textEl = document.getElementById('etirozText' + qi);
  var text = textEl ? textEl.value.trim() : '';
  if (!text) { showToast('⚠️', 'Xato', "Iltimos, e'tiroz sababini yozing"); return; }
  var q = _currentTestQuestions[qi];
  var user = currentUser || {name:'Noma\'lum talaba', group:'Guruh'};
  var now = new Date();
  var dateStr = now.getDate() + '.' + (now.getMonth()+1) + '.' + now.getFullYear();
  var subjectName = (document.getElementById('testSubjectName')||{textContent:''}).textContent;
  var detail = "E'tiroz: " + (qi+1) + "-savol — «" + q.q.substring(0,60) + (q.q.length>60?'...':'') + "»";

  // Push to local APPLICATIONS array (localStorage-persisted)
  APPLICATIONS.push({
    id: APPLICATIONS.length + 1,
    studentName: user.name,
    fullName: user.name,
    group: user.group || 'A-101',
    type: 'etiraz',
    detail: detail,
    company: "Test: " + subjectName,
    price: '—',
    date: dateStr,
    status: 'pending',
    note: text,
    phone: '',
    email: ''
  });
  updateAppBadges();
  saveApplications(); // localStorage persistence

  // Also send to backend API (non-blocking)
  apiSubmitApplication({
    type: 'etiraz',
    detail: detail,
    company: 'Test: ' + subjectName,
    note: text,
    questionIndex: qi,
    examType: 'test',
    subject: _currentTestSubject || ''
  }).catch(function(){});  // silent fail — localStorage is the source of truth

  document.getElementById('etirozBox' + qi).style.display = 'none';
  showToast('✅', "E'tiroz yuborildi!", "Dekanat ko'rib chiqadi", 'green');
}

function renderSesiyaReal() {
  var locked = document.getElementById('sreal-locked');
  var instr = document.getElementById('sreal-instructions');
  var active = document.getElementById('sreal-active');
  var results = document.getElementById('sreal-results');
  if (!locked) return;
  if (SESIYA_STATE.real) {
    locked.style.display = 'none';
    active.style.display = 'none';
    results.style.display = 'none';
    instr.style.display = 'block';
    document.getElementById('realPageSub').textContent = 'Fanni tanlang va imtihonni boshlang';
  } else {
    locked.style.display = 'flex';
    instr.style.display = 'none';
    active.style.display = 'none';
    results.style.display = 'none';
    if (_realTimer) { clearInterval(_realTimer); _realTimer = null; }
  }
}

function startRealWithSubject(subj) {
  _currentRealSubject = subj;
  _currentRealQuestions = getRealQuestions(subj);
  _realAnswers = {};

  var icons = {algo:'💻', ai:'🤖', math:'📐', db:'🗄️', web:'🌐'};
  var names = {algo:'Algoritmlar va Dasturlash', ai:"Sun'iy Intellekt", math:'Matematika (AI uchun)', db:"Ma'lumotlar Bazasi", web:'Web Dasturlash'};

  document.getElementById('realSubjectIcon').textContent = icons[subj] || '📝';
  document.getElementById('realSubjectName').textContent = names[subj] || subj;
  document.getElementById('realProgressLabel').textContent = '0/' + _currentRealQuestions.length;
  document.getElementById('realProgressBar').style.width = '0%';
  document.getElementById('realPageSub').textContent = names[subj] + ' · Rasmiy imtihon';

  var container = document.getElementById('realQuestionsContainer');
  var html = '';
  _currentRealQuestions.forEach(function(q, i) {
    html += '<div id="rq-' + i + '" style="background:white;border:1.5px solid #E2E8F0;border-radius:12px;padding:18px 20px;margin-bottom:14px;transition:border-color 0.2s">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">';
    html += '<div style="font-size:13.5px;font-weight:700;color:#0F172A;line-height:1.5"><span style="color:#94A3B8;margin-right:6px">' + (i+1) + '.</span>' + q.q + '</div>';
    html += '<button onclick="toggleRealEtirozBox(' + i + ')" style="white-space:nowrap;padding:4px 10px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:6px;font-size:11px;font-weight:600;color:#EA580C;cursor:pointer;font-family:\'Outfit\',sans-serif">⚠️ E\'tiroz</button>';
    html += '</div>';
    html += '<div style="display:flex;flex-direction:column;gap:8px">';
    q.opts.forEach(function(opt, j) {
      html += '<label id="rq-' + i + '-opt-' + j + '" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;cursor:pointer;font-size:13px;transition:all 0.15s" onmouseover="this.style.borderColor=\'#DC2626\';this.style.background=\'#FFF5F5\'" onmouseout="this.style.borderColor=(document.getElementById(\'rq'+i+'ans\').value===\''+j+'\'?\'#DC2626\':\'#E2E8F0\');this.style.background=(document.getElementById(\'rq'+i+'ans\').value===\''+j+'\'?\'#FFF5F5\':\'white\')">';
      html += '<input type="radio" name="rq' + i + '" value="' + j + '" style="accent-color:#DC2626;width:16px;height:16px" onchange="onRealAnswer(' + i + ',' + j + ')"> ' + opt;
      html += '</label>';
    });
    html += '</div>';
    html += '<input type="hidden" id="rq' + i + 'ans" value="">';
    html += '<div id="realEtirozBox' + i + '" style="display:none;margin-top:12px;background:#FFF7ED;border:1.5px solid #FED7AA;border-radius:10px;padding:14px">';
    html += '<div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:8px">⚠️ ' + (i+1) + '-savol bo\'yicha e\'tiroz:</div>';
    html += '<textarea id="realEtirozText' + i + '" placeholder="E\'tirozingiz sababini yozing..." style="width:100%;padding:10px;border:1.5px solid #FED7AA;border-radius:8px;font-family:\'Outfit\',sans-serif;font-size:13px;resize:vertical;min-height:70px;outline:none;box-sizing:border-box"></textarea>';
    html += '<div style="display:flex;gap:8px;margin-top:8px">';
    html += '<button onclick="submitRealEtiraz(' + i + ')" style="padding:7px 16px;background:#EA580C;color:white;border:none;border-radius:7px;font-family:\'Outfit\',sans-serif;font-size:12.5px;font-weight:700;cursor:pointer">📤 Dekanatga yuborish</button>';
    html += '<button onclick="document.getElementById(\'realEtirozBox' + i + '\').style.display=\'none\'" style="padding:7px 14px;background:white;border:1.5px solid #E2E8F0;border-radius:7px;font-family:\'Outfit\',sans-serif;font-size:12.5px;cursor:pointer">Bekor</button>';
    html += '</div></div>';
    html += '</div>';
  });
  container.innerHTML = html;

  document.getElementById('sreal-instructions').style.display = 'none';
  document.getElementById('sreal-active').style.display = 'block';
  document.getElementById('sreal-results').style.display = 'none';

  if (_realTimer) clearInterval(_realTimer);
  _realSec = 90 * 60;
  document.getElementById('realTimerDisplay').textContent = '90:00';
  _realTimer = setInterval(function() {
    _realSec--;
    var m = Math.floor(_realSec/60).toString().padStart(2,'0');
    var s = (_realSec%60).toString().padStart(2,'0');
    var el = document.getElementById('realTimerDisplay');
    if (el) {
      el.textContent = m + ':' + s;
      el.style.color = _realSec < 600 ? '#B91C1C' : '#DC2626';
      if (_realSec < 600) el.style.animation = 'pulse-red 1s infinite';
    }
    if (_realSec <= 0) { clearInterval(_realTimer); _realTimer = null; submitRealExam(); }
  }, 1000);

  window.scrollTo({top: 0, behavior: 'smooth'});
}

function onRealAnswer(qi, optIdx) {
  _realAnswers[qi] = optIdx;
  var hidden = document.getElementById('rq' + qi + 'ans');
  if (hidden) hidden.value = optIdx;
  var qs = _currentRealQuestions[qi];
  qs.opts.forEach(function(_, j) {
    var lbl = document.getElementById('rq-' + qi + '-opt-' + j);
    if (lbl) {
      lbl.style.borderColor = j === optIdx ? '#DC2626' : '#E2E8F0';
      lbl.style.background = j === optIdx ? '#FFF5F5' : 'white';
    }
  });
  var card = document.getElementById('rq-' + qi);
  if (card) card.style.borderColor = '#86EFAC';
  var answered = Object.keys(_realAnswers).length;
  var total = _currentRealQuestions.length;
  var pct = Math.round(answered / total * 100);
  var pb = document.getElementById('realProgressBar');
  if (pb) pb.style.width = pct + '%';
  var pl = document.getElementById('realProgressLabel');
  if (pl) pl.textContent = answered + '/' + total;
  var ac = document.getElementById('realAnsweredCount');
  if (ac) ac.textContent = answered + ' ta savol javob berildi';
}

function toggleRealEtirozBox(qi) {
  var box = document.getElementById('realEtirozBox' + qi);
  if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function submitRealEtiraz(qi) {
  var textEl = document.getElementById('realEtirozText' + qi);
  var text = textEl ? textEl.value.trim() : '';
  if (!text) { showToast('⚠️', 'Xato', "Iltimos, e'tiroz sababini yozing"); return; }
  var q = _currentRealQuestions[qi];
  var user = currentUser || {name:'Noma\'lum talaba', group:'Guruh'};
  var now = new Date();
  var dateStr = now.getDate() + '.' + (now.getMonth()+1) + '.' + now.getFullYear();
  var subjectName = (document.getElementById('realSubjectName')||{textContent:''}).textContent;
  var detail = "E'tiroz (Sesiya): " + (qi+1) + "-savol — «" + q.q.substring(0,60) + (q.q.length>60?'...':'') + "»";

  APPLICATIONS.push({
    id: APPLICATIONS.length + 1,
    studentName: user.name,
    fullName: user.name,
    group: user.group || 'A-101',
    type: 'etiraz',
    detail: detail,
    company: "Sesiya: " + subjectName,
    price: '—',
    date: dateStr,
    status: 'pending',
    note: text,
    phone: '',
    email: ''
  });
  updateAppBadges();
  saveApplications(); // localStorage persistence

  // Also send to backend API
  apiSubmitApplication({
    type: 'etiraz',
    detail: detail,
    company: 'Sesiya: ' + subjectName,
    note: text,
    questionIndex: qi,
    examType: 'sesiya',
    subject: _currentRealSubject || ''
  }).catch(function(){});

  document.getElementById('realEtirozBox' + qi).style.display = 'none';
  showToast('✅', "E'tiroz yuborildi!", "Dekanat ko'rib chiqadi", 'green');
}

function renderDekanatSesiya() {
  // Re-sync UI with current state
  setSesiyaState('test', SESIYA_STATE.test);
  setSesiyaState('real', SESIYA_STATE.real);
}

function startExamTimer(type) {
  if (type === 'test') {
    if (_testTimer) return;
    _testSec = 30 * 60;
    _testTimer = setInterval(function() {
      _testSec--;
      var el = document.getElementById('testTimerDisplay');
      if (el) el.textContent = Math.floor(_testSec/60).toString().padStart(2,'0') + ':' + (_testSec%60).toString().padStart(2,'0');
      if (_testSec <= 0) { clearInterval(_testTimer); _testTimer = null; submitTestExam(); }
    }, 1000);
  } else {
    if (_realTimer) return;
    _realSec = 90 * 60;
    _realTimer = setInterval(function() {
      _realSec--;
      var el = document.getElementById('realTimerDisplay');
      if (el) el.textContent = Math.floor(_realSec/60).toString().padStart(2,'0') + ':' + (_realSec%60).toString().padStart(2,'0');
      if (_realSec <= 0) { clearInterval(_realTimer); _realTimer = null; submitRealExam(); }
    }, 1000);
  }
}

function submitTestExam() {
  if (_testTimer) { clearInterval(_testTimer); _testTimer = null; }

  var qs = _currentTestQuestions;
  var total = qs.length;
  var correct = 0;
  var resultRows = '';

  qs.forEach(function(q, i) {
    var chosen = (_testAnswers[i] !== undefined) ? parseInt(_testAnswers[i]) : -1;
    var isCorrect = chosen === q.ans;
    if (isCorrect) correct++;
    var statusIcon = isCorrect ? '✅' : (chosen === -1 ? '⬛' : '❌');
    var statusColor = isCorrect ? '#16A34A' : (chosen === -1 ? '#94A3B8' : '#DC2626');
    var statusBg = isCorrect ? '#DCFCE7' : (chosen === -1 ? '#F1F5F9' : '#FEE2E2');

    resultRows += '<div style="background:white;border:1.5px solid ' + (isCorrect ? '#86EFAC' : (chosen===-1?'#E2E8F0':'#FCA5A5')) + ';border-radius:12px;padding:16px 18px;margin-bottom:10px">';
    resultRows += '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:' + (isCorrect?'0':'10px') + '">';
    resultRows += '<span style="min-width:26px;height:26px;border-radius:50%;background:' + statusBg + ';display:flex;align-items:center;justify-content:center;font-size:14px">' + statusIcon + '</span>';
    resultRows += '<div style="flex:1">';
    resultRows += '<div style="font-size:13px;font-weight:700;color:#0F172A;line-height:1.5"><span style="color:#94A3B8;margin-right:5px">' + (i+1) + '.</span>' + q.q + '</div>';
    if (!isCorrect && chosen !== -1) {
      resultRows += '<div style="margin-top:8px;font-size:12.5px;color:#DC2626">❌ Sizning javobingiz: <strong>' + q.opts[chosen] + '</strong></div>';
    } else if (chosen === -1) {
      resultRows += '<div style="margin-top:8px;font-size:12.5px;color:#94A3B8">⬛ Javob berilmadi</div>';
    }
    if (!isCorrect) {
      resultRows += '<div style="margin-top:6px;font-size:12.5px;color:#16A34A">✅ To\'g\'ri javob: <strong>' + q.opts[q.ans] + '</strong></div>';
    }
    resultRows += '</div></div>';
    // Always show explanation
    resultRows += '<div style="background:#F8FAFC;border-radius:8px;padding:10px 12px;margin-top:' + (isCorrect?'10px':'4px') + ';border:1px solid #E2E8F0">';
    resultRows += '<span style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.4px">💡 Izoh: </span>';
    resultRows += '<span style="font-size:12.5px;color:#334155">' + q.izoh + '</span>';
    resultRows += '</div>';
    resultRows += '</div>';
  });

  var pct = Math.round(correct / total * 100);
  var grade = pct >= 86 ? {l:'A', c:'#16A34A', bg:'#DCFCE7'} : pct >= 71 ? {l:'B', c:'#2563EB', bg:'#DBEAFE'} : pct >= 56 ? {l:'C', c:'#D97706', bg:'#FEF3C7'} : pct >= 41 ? {l:'D', c:'#EA580C', bg:'#FFF7ED'} : {l:'F', c:'#DC2626', bg:'#FEE2E2'};
  var msg = pct >= 86 ? "🎉 A'lo! Zo'r natija!" : pct >= 71 ? "👍 Yaxshi natija!" : pct >= 56 ? "💪 Qoniqarli, ko'proq o'rganing!" : "📖 Yaxshiroq tayyorlaning!";

  var html = '';
  // Score card
  html += '<div style="background:linear-gradient(135deg,' + grade.bg + ',white);border:2px solid ' + grade.c + ';border-radius:16px;padding:28px;margin-bottom:22px;text-align:center">';
  html += '<div style="font-size:52px;font-weight:900;color:' + grade.c + ';font-family:\'DM Mono\',monospace">' + grade.l + '</div>';
  html += '<div style="font-size:28px;font-weight:800;color:#0F172A;margin:8px 0">' + pct + '%</div>';
  html += '<div style="font-size:15px;font-weight:600;color:#475569;margin-bottom:12px">' + correct + ' / ' + total + ' to\'g\'ri javob</div>';
  html += '<div style="font-size:14px;color:' + grade.c + ';font-weight:700">' + msg + '</div>';
  html += '</div>';
  // Stats row
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px">';
  html += '<div style="background:white;border:1.5px solid #86EFAC;border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#16A34A">' + correct + '</div><div style="font-size:12px;color:#64748B;margin-top:3px">To\'g\'ri</div></div>';
  html += '<div style="background:white;border:1.5px solid #FCA5A5;border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#DC2626">' + (total - correct - (total - Object.keys(_testAnswers).length)) + '</div><div style="font-size:12px;color:#64748B;margin-top:3px">Noto\'g\'ri</div></div>';
  html += '<div style="background:white;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#94A3B8">' + (total - Object.keys(_testAnswers).length) + '</div><div style="font-size:12px;color:#64748B;margin-top:3px">Javobsiz</div></div>';
  html += '</div>';
  // Detailed results
  html += '<div style="font-size:15px;font-weight:800;color:#0F172A;margin-bottom:14px">📋 Batafsil natijalar:</div>';
  html += resultRows;

  document.getElementById('testResultsContent').innerHTML = html;
  document.getElementById('stest-active').style.display = 'none';
  document.getElementById('stest-results').style.display = 'block';
  document.getElementById('testPageSub').textContent = 'Test yakunlandi · ' + correct + '/' + total + ' to\'g\'ri';
  window.scrollTo({top: 0, behavior: 'smooth'});
  showToast('🎉', 'Test yakunlandi!', correct + '/' + total + ' to\'g\'ri javob · ' + grade.l + ' baho', 'blue');
}

function submitRealExam() {
  if (_realTimer) { clearInterval(_realTimer); _realTimer = null; }

  var qs = _currentRealQuestions;
  var total = qs.length;
  var correct = 0;
  var resultRows = '';

  qs.forEach(function(q, i) {
    var chosen = (_realAnswers[i] !== undefined) ? parseInt(_realAnswers[i]) : -1;
    var isCorrect = chosen === q.ans;
    if (isCorrect) correct++;
    var statusIcon = isCorrect ? '✅' : (chosen === -1 ? '⬛' : '❌');
    var statusBg = isCorrect ? '#DCFCE7' : (chosen === -1 ? '#F1F5F9' : '#FEE2E2');

    resultRows += '<div style="background:white;border:1.5px solid ' + (isCorrect ? '#86EFAC' : (chosen===-1?'#E2E8F0':'#FCA5A5')) + ';border-radius:12px;padding:16px 18px;margin-bottom:10px">';
    resultRows += '<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:' + (isCorrect?'0':'10px') + '">';
    resultRows += '<span style="min-width:26px;height:26px;border-radius:50%;background:' + statusBg + ';display:flex;align-items:center;justify-content:center;font-size:14px">' + statusIcon + '</span>';
    resultRows += '<div style="flex:1">';
    resultRows += '<div style="font-size:13px;font-weight:700;color:#0F172A;line-height:1.5"><span style="color:#94A3B8;margin-right:5px">' + (i+1) + '.</span>' + q.q + '</div>';
    if (!isCorrect && chosen !== -1) {
      resultRows += '<div style="margin-top:8px;font-size:12.5px;color:#DC2626">❌ Sizning javobingiz: <strong>' + q.opts[chosen] + '</strong></div>';
    } else if (chosen === -1) {
      resultRows += '<div style="margin-top:8px;font-size:12.5px;color:#94A3B8">⬛ Javob berilmadi</div>';
    }
    if (!isCorrect) {
      resultRows += '<div style="margin-top:6px;font-size:12.5px;color:#16A34A">✅ To\'g\'ri javob: <strong>' + q.opts[q.ans] + '</strong></div>';
    }
    resultRows += '</div></div>';
    resultRows += '<div style="background:#F8FAFC;border-radius:8px;padding:10px 12px;margin-top:' + (isCorrect?'10px':'4px') + ';border:1px solid #E2E8F0">';
    resultRows += '<span style="font-size:11px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:0.4px">💡 Izoh: </span>';
    resultRows += '<span style="font-size:12.5px;color:#334155">' + q.izoh + '</span>';
    resultRows += '</div></div>';
  });

  var pct = Math.round(correct / total * 100);
  var ball = Math.round(pct); // 100 ball scale
  var grade = pct >= 86 ? {l:'A (A\'lo)', c:'#16A34A', bg:'#DCFCE7'} : pct >= 71 ? {l:'B (Yaxshi)', c:'#2563EB', bg:'#DBEAFE'} : pct >= 56 ? {l:'C (Qoniqarli)', c:'#D97706', bg:'#FEF3C7'} : pct >= 41 ? {l:'D (Qoniqarsiz)', c:'#EA580C', bg:'#FFF7ED'} : {l:'F (Yiqildi)', c:'#DC2626', bg:'#FEE2E2'};
  var msg = pct >= 86 ? "🎉 Zo'r natija! Imtihonni muvaffaqiyatli topshirdingiz!" : pct >= 71 ? "👍 Yaxshi natija!" : pct >= 56 ? "✅ Qoniqarli natija." : pct >= 41 ? "⚠️ Qoniqarsiz. Qayta topshirish tavsiya etiladi." : "❌ Imtihondan o'tmadingiz. Dekanatga murojaat qiling.";

  var html = '';
  html += '<div style="background:linear-gradient(135deg,' + grade.bg + ',white);border:2px solid ' + grade.c + ';border-radius:16px;padding:28px;margin-bottom:22px;text-align:center">';
  html += '<div style="font-size:14px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">RASMIY IMTIHON NATIJASI</div>';
  html += '<div style="font-size:44px;font-weight:900;color:' + grade.c + ';margin-bottom:4px">' + ball + '</div>';
  html += '<div style="font-size:16px;color:#64748B;margin-bottom:8px">ball / 100</div>';
  html += '<div style="font-size:18px;font-weight:800;color:' + grade.c + ';margin-bottom:10px">' + grade.l + '</div>';
  html += '<div style="font-size:15px;font-weight:600;color:#475569;margin-bottom:10px">' + correct + ' / ' + total + ' to\'g\'ri javob</div>';
  html += '<div style="font-size:14px;color:' + grade.c + ';font-weight:700">' + msg + '</div>';
  html += '</div>';

  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px">';
  html += '<div style="background:white;border:1.5px solid #86EFAC;border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#16A34A">' + correct + '</div><div style="font-size:12px;color:#64748B;margin-top:3px">To\'g\'ri</div></div>';
  html += '<div style="background:white;border:1.5px solid #FCA5A5;border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#DC2626">' + (total - correct - (total - Object.keys(_realAnswers).length)) + '</div><div style="font-size:12px;color:#64748B;margin-top:3px">Noto\'g\'ri</div></div>';
  html += '<div style="background:white;border:1.5px solid #E2E8F0;border-radius:12px;padding:14px;text-align:center"><div style="font-size:22px;font-weight:800;color:#94A3B8">' + (total - Object.keys(_realAnswers).length) + '</div><div style="font-size:12px;color:#64748B;margin-top:3px">Javobsiz</div></div>';
  html += '</div>';

  html += '<div style="background:#F0FDF4;border:1.5px solid #86EFAC;border-radius:12px;padding:14px 16px;margin-bottom:20px;display:flex;align-items:center;gap:12px">';
  html += '<span style="font-size:22px">📤</span><div><div style="font-size:13px;font-weight:700;color:#16A34A">Imtihon topshirildi!</div><div style="font-size:12.5px;color:#64748B">Natijalaringiz dekanatga yuborildi va saqlanmoqda.</div></div>';
  html += '</div>';

  html += '<div style="font-size:15px;font-weight:800;color:#0F172A;margin-bottom:14px">📋 Batafsil natijalar va izohlar:</div>';
  html += resultRows;

  document.getElementById('realResultsContent').innerHTML = html;
  document.getElementById('sreal-active').style.display = 'none';
  document.getElementById('sreal-results').style.display = 'block';
  document.getElementById('realPageSub').textContent = 'Imtihon yakunlandi · ' + ball + '/100 ball · ' + grade.l;
  window.scrollTo({top: 0, behavior: 'smooth'});
  showToast('📤', 'Imtihon topshirildi!', ball + '/100 ball · ' + grade.l, 'green');
}


// ═══════════════════════════════════════════════
// LOCALSTORAGE PERSISTENCE — APPLICATIONS
// ═══════════════════════════════════════════════
function saveApplications() {
  try { localStorage.setItem('idu_applications', JSON.stringify(APPLICATIONS)); } catch(e) {}
}
function loadApplications() {
  try {
    var s = localStorage.getItem('idu_applications');
    if (s) { var arr = JSON.parse(s); if (Array.isArray(arr)) APPLICATIONS = arr; }
  } catch(e) {}
}

// Override APPLICATIONS.push to auto-save
var _origAppPush = Array.prototype.push;
(function() {
  var _savedApps = APPLICATIONS;
  Object.defineProperty(window, 'APPLICATIONS', {
    get: function() { return _savedApps; },
    set: function(v) { _savedApps = v; },
    configurable: true
  });
})();

// Patch updateAppStatus and submitEtiraz to auto-save
var _origUpdateAppStatus = updateAppStatus;
updateAppStatus = function(id, status) {
  _origUpdateAppStatus(id, status);
  saveApplications();
};

// Load on startup
loadApplications();

// ═══════════════════════════════════════════════
// DEKANAT QUESTIONS — LOCALSTORAGE
// ═══════════════════════════════════════════════
var DEKANAT_QUESTIONS = [];
var _editingQId = null;
var _currentQFilter = 'all';

function loadDekanatQuestions() {
  try {
    var s = localStorage.getItem('idu_dekanat_questions');
    if (s) { var arr = JSON.parse(s); if (Array.isArray(arr)) DEKANAT_QUESTIONS = arr; }
  } catch(e) {}
}
function saveDekanatQuestions() {
  try { localStorage.setItem('idu_dekanat_questions', JSON.stringify(DEKANAT_QUESTIONS)); } catch(e) {}
}
loadDekanatQuestions();

// Override question sources: use dekanat questions when available
var _origStartTestWithSubject = startTestWithSubject;
startTestWithSubject = function(subj) {
  var dekQs = DEKANAT_QUESTIONS.filter(function(q) { return q.subject === subj && (q.type === 'test' || q.type === 'both'); });
  if (dekQs.length >= 20) {
    _currentTestSubject = subj;
    _currentTestQuestions = dekQs.slice(0, 20);
    _testAnswers = {};
    var icons = {algo:'💻', ai:'🤖', math:'📐', db:'🗄️', web:'🌐'};
    var names = {algo:'Algoritmlar va Dasturlash', ai:"Sun'iy Intellekt", math:'Matematika (AI uchun)', db:"Ma'lumotlar Bazasi", web:'Web Dasturlash'};
    document.getElementById('testSubjectIcon').textContent = icons[subj] || '📝';
    document.getElementById('testSubjectName').textContent = names[subj] || subj;
    document.getElementById('testProgressLabel').textContent = '0/20';
    document.getElementById('testProgressBar').style.width = '0%';
    document.getElementById('testPageSub').textContent = names[subj] + ' · Dekanat savollari';
    var container = document.getElementById('testQuestionsContainer');
    var html = '';
    _currentTestQuestions.forEach(function(q, i) {
      html += _buildTestQHtml(q, i, 'test');
    });
    container.innerHTML = html;
    document.getElementById('stest-instructions').style.display = 'none';
    document.getElementById('stest-active').style.display = 'block';
    document.getElementById('stest-results').style.display = 'none';
    if (_testTimer) clearInterval(_testTimer);
    _testSec = 30 * 60;
    document.getElementById('testTimerDisplay').textContent = '30:00';
    _testTimer = setInterval(function() {
      _testSec--;
      var m = Math.floor(_testSec/60).toString().padStart(2,'0');
      var s = (_testSec%60).toString().padStart(2,'0');
      var el = document.getElementById('testTimerDisplay');
      if (el) { el.textContent = m + ':' + s; el.style.color = _testSec < 300 ? '#DC2626' : '#1B4FD8'; }
      if (_testSec <= 0) { clearInterval(_testTimer); _testTimer = null; submitTestExam(); }
    }, 1000);
    window.scrollTo({top: 0, behavior: 'smooth'});
  } else {
    _origStartTestWithSubject(subj);
  }
};

var _origStartRealWithSubject = startRealWithSubject;
startRealWithSubject = function(subj) {
  var dekQs = DEKANAT_QUESTIONS.filter(function(q) { return q.subject === subj && (q.type === 'real' || q.type === 'both'); });
  if (dekQs.length >= 30) {
    _currentRealSubject = subj;
    _currentRealQuestions = dekQs.slice(0, 30);
    _realAnswers = {};
    var icons = {algo:'💻', ai:'🤖', math:'📐', db:'🗄️', web:'🌐'};
    var names = {algo:'Algoritmlar va Dasturlash', ai:"Sun'iy Intellekt", math:'Matematika (AI uchun)', db:"Ma'lumotlar Bazasi", web:'Web Dasturlash'};
    document.getElementById('realSubjectIcon').textContent = icons[subj] || '📝';
    document.getElementById('realSubjectName').textContent = names[subj] || subj;
    document.getElementById('realProgressLabel').textContent = '0/30';
    document.getElementById('realProgressBar').style.width = '0%';
    document.getElementById('realPageSub').textContent = names[subj] + ' · Dekanat savollari';
    var container = document.getElementById('realQuestionsContainer');
    var html = '';
    _currentRealQuestions.forEach(function(q, i) {
      html += _buildTestQHtml(q, i, 'real');
    });
    container.innerHTML = html;
    document.getElementById('sreal-instructions').style.display = 'none';
    document.getElementById('sreal-active').style.display = 'block';
    document.getElementById('sreal-results').style.display = 'none';
    if (_realTimer) clearInterval(_realTimer);
    _realSec = 90 * 60;
    document.getElementById('realTimerDisplay').textContent = '90:00';
    _realTimer = setInterval(function() {
      _realSec--;
      var m = Math.floor(_realSec/60).toString().padStart(2,'0');
      var s = (_realSec%60).toString().padStart(2,'0');
      var el = document.getElementById('realTimerDisplay');
      if (el) { el.textContent = m + ':' + s; el.style.color = _realSec < 600 ? '#B91C1C' : '#DC2626'; }
      if (_realSec <= 0) { clearInterval(_realTimer); _realTimer = null; submitRealExam(); }
    }, 1000);
    window.scrollTo({top: 0, behavior: 'smooth'});
  } else {
    _origStartRealWithSubject(subj);
  }
};

function _buildTestQHtml(q, i, mode) {
  var isReal = mode === 'real';
  var acColor = isReal ? '#DC2626' : '#1B4FD8';
  var hoverColor = isReal ? '#DC2626' : '#1B4FD8';
  var hoverBg = isReal ? '#FFF5F5' : '#F8FBFF';
  var prefix = isReal ? 'r' : 't';
  var eBox = isReal ? 'realEtirozBox' : 'etirozBox';
  var eText = isReal ? 'realEtirozText' : 'etirozText';
  var ansHandler = isReal ? 'onRealAnswer' : 'onTestAnswer';
  var eToggle = isReal ? 'toggleRealEtirozBox' : 'toggleEtirozBox';
  var eSubmit = isReal ? 'submitRealEtiraz' : 'submitEtiraz';
  var html = '<div id="' + prefix + 'q-' + i + '" style="background:white;border:1.5px solid #E2E8F0;border-radius:12px;padding:18px 20px;margin-bottom:14px;transition:border-color 0.2s">';
  html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px">';
  html += '<div style="font-size:13.5px;font-weight:700;color:#0F172A;line-height:1.5"><span style="color:#94A3B8;margin-right:6px">' + (i+1) + '.</span>' + q.q + '</div>';
  html += '<button onclick="' + eToggle + '(' + i + ')" style="white-space:nowrap;padding:4px 10px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:6px;font-size:11px;font-weight:600;color:#EA580C;cursor:pointer;font-family:\'Outfit\',sans-serif">⚠️ E\'tiroz</button>';
  html += '</div>';
  html += '<div style="display:flex;flex-direction:column;gap:8px">';
  q.opts.forEach(function(opt, j) {
    html += '<label id="' + prefix + 'q-' + i + '-opt-' + j + '" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border:1.5px solid #E2E8F0;border-radius:8px;cursor:pointer;font-size:13px;transition:all 0.15s">';
    html += '<input type="radio" name="' + prefix + 'q' + i + '" value="' + j + '" style="accent-color:' + acColor + ';width:16px;height:16px" onchange="' + ansHandler + '(' + i + ',' + j + ')"> ' + opt;
    html += '</label>';
  });
  html += '</div>';
  html += '<input type="hidden" id="' + prefix + 'q' + i + 'ans" value="">';
  html += '<div id="' + eBox + i + '" style="display:none;margin-top:12px;background:#FFF7ED;border:1.5px solid #FED7AA;border-radius:10px;padding:14px">';
  html += '<div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:8px">⚠️ ' + (i+1) + '-savol bo\'yicha e\'tiroz:</div>';
  html += '<textarea id="' + eText + i + '" placeholder="E\'tirozingiz sababini yozing..." style="width:100%;padding:10px;border:1.5px solid #FED7AA;border-radius:8px;font-family:\'Outfit\',sans-serif;font-size:13px;resize:vertical;min-height:70px;outline:none;box-sizing:border-box"></textarea>';
  html += '<div style="display:flex;gap:8px;margin-top:8px">';
  html += '<button onclick="' + eSubmit + '(' + i + ')" style="padding:7px 16px;background:#EA580C;color:white;border:none;border-radius:7px;font-family:\'Outfit\',sans-serif;font-size:12.5px;font-weight:700;cursor:pointer">📤 Dekanatga yuborish</button>';
  html += '<button onclick="document.getElementById(\'' + eBox + i + '\').style.display=\'none\'" style="padding:7px 14px;background:white;border:1.5px solid #E2E8F0;border-radius:7px;font-family:\'Outfit\',sans-serif;font-size:12.5px;cursor:pointer">Bekor</button>';
  html += '</div></div></div>';
  return html;
}

// ═══════════════════════════════════════════════
// DEKANAT QUESTIONS — UI FUNCTIONS
// ═══════════════════════════════════════════════
var SUBJ_LABELS = {algo:'💻 Algo', ai:'🤖 AI', math:'📐 Math', db:'🗄️ DB', web:'🌐 Web'};
var TYPE_LABELS = {test:'🧪 Test', real:'📋 Sesiya', both:'📝 Ikkalasi'};

function renderDekanatQuestions() {
  loadDekanatQuestions();
  _updateQStats();
  _renderQTable(_currentQFilter);
}

function _updateQStats() {
  var total = DEKANAT_QUESTIONS.length;
  var testQ = DEKANAT_QUESTIONS.filter(function(q) { return q.type === 'test' || q.type === 'both'; }).length;
  var realQ = DEKANAT_QUESTIONS.filter(function(q) { return q.type === 'real' || q.type === 'both'; }).length;
  var subjs = [...new Set(DEKANAT_QUESTIONS.map(function(q) { return q.subject; }))].length;
  var e1 = document.getElementById('qStatTotal'); if(e1) e1.textContent = total;
  var e2 = document.getElementById('qStatTest'); if(e2) e2.textContent = testQ;
  var e3 = document.getElementById('qStatReal'); if(e3) e3.textContent = realQ;
  var e4 = document.getElementById('qStatSubjects'); if(e4) e4.textContent = subjs;
}

function filterQs(filter, el) {
  _currentQFilter = filter;
  document.querySelectorAll('#page-dekanat-questions .filter-chip').forEach(function(c) { c.classList.remove('active'); });
  if (el) el.classList.add('active');
  _renderQTable(filter);
}

function _renderQTable(filter) {
  var qs = [...DEKANAT_QUESTIONS];
  if (filter === 'test') qs = qs.filter(function(q) { return q.type === 'test' || q.type === 'both'; });
  else if (filter === 'real') qs = qs.filter(function(q) { return q.type === 'real' || q.type === 'both'; });
  else if (['algo','ai','math','db','web'].includes(filter)) qs = qs.filter(function(q) { return q.subject === filter; });
  var tbody = document.getElementById('questionsTableBody');
  if (!tbody) return;
  if (!qs.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:40px"><div style="font-size:28px;margin-bottom:8px">📝</div><div>Hali savol kiritilmagan</div></td></tr>';
    return;
  }
  tbody.innerHTML = qs.map(function(q, i) {
    return '<tr>' +
      '<td><strong>' + (i+1) + '</strong></td>' +
      '<td><span style="padding:3px 8px;background:#EEF3FF;border-radius:6px;font-size:11.5px;font-weight:700;color:#1B4FD8">' + (SUBJ_LABELS[q.subject] || q.subject) + '</span></td>' +
      '<td><span style="padding:3px 8px;border-radius:6px;font-size:11.5px;font-weight:700;background:' + (q.type==='test'?'#DCFCE7':q.type==='real'?'#FEE2E2':'#F3E8FF') + ';color:' + (q.type==='test'?'#16A34A':q.type==='real'?'#DC2626':'#7C3AED') + '">' + (TYPE_LABELS[q.type] || q.type) + '</span></td>' +
      '<td style="max-width:300px"><div style="font-weight:600;font-size:13px;line-height:1.4">' + q.q.substring(0,80) + (q.q.length>80?'...':'') + '</div>' +
        '<div style="font-size:11px;color:#64748B;margin-top:3px">✅ ' + (q.opts[q.ans]||'').substring(0,50) + '</div></td>' +
      '<td style="font-size:12px;color:#16A34A;font-weight:600">' + ['A','B','C','D'][q.ans] + ' – ' + (q.opts[q.ans]||'').substring(0,20) + '</td>' +
      '<td><div style="display:flex;gap:5px">' +
        '<button onclick="editQuestion(' + q.id + ')" style="padding:5px 10px;background:#EEF3FF;border:none;border-radius:6px;color:#1B4FD8;font-size:12px;cursor:pointer;font-weight:600">✏️</button>' +
        '<button onclick="deleteQuestion(' + q.id + ')" style="padding:5px 10px;background:#FEE2E2;border:none;border-radius:6px;color:#DC2626;font-size:12px;cursor:pointer;font-weight:600">🗑️</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');
}

function openAddQuestionModal() {
  _editingQId = null;
  document.getElementById('questionModalTitle').textContent = '➕ Yangi savol qo\'shish';
  document.getElementById('qModalText').value = '';
  document.getElementById('qModalIzoh').value = '';
  document.getElementById('qOpt0').value = '';
  document.getElementById('qOpt1').value = '';
  document.getElementById('qOpt2').value = '';
  document.getElementById('qOpt3').value = '';
  document.querySelectorAll('input[name="qModalCorrect"]').forEach(function(r) { r.checked = false; });
  document.querySelector('input[name="qModalCorrect"][value="0"]').checked = true;
  document.getElementById('addQuestionModal').style.display = 'block';
}

function editQuestion(id) {
  var q = DEKANAT_QUESTIONS.find(function(x) { return x.id === id; });
  if (!q) return;
  _editingQId = id;
  document.getElementById('questionModalTitle').textContent = '✏️ Savolni tahrirlash';
  document.getElementById('qModalSubject').value = q.subject;
  document.getElementById('qModalType').value = q.type;
  document.getElementById('qModalText').value = q.q;
  document.getElementById('qModalIzoh').value = q.izoh || '';
  q.opts.forEach(function(opt, i) {
    var el = document.getElementById('qOpt' + i);
    if (el) el.value = opt;
  });
  var radio = document.querySelector('input[name="qModalCorrect"][value="' + q.ans + '"]');
  if (radio) radio.checked = true;
  document.getElementById('addQuestionModal').style.display = 'block';
}

function deleteQuestion(id) {
  if (!confirm('Bu savolni o\'chirishni tasdiqlaysizmi?')) return;
  DEKANAT_QUESTIONS = DEKANAT_QUESTIONS.filter(function(q) { return q.id !== id; });
  saveDekanatQuestions();
  renderDekanatQuestions();
  showToast('🗑️', 'O\'chirildi', 'Savol o\'chirildi', 'red');
}

function clearAllDekanatQuestions() {
  if (!confirm('Barcha ' + DEKANAT_QUESTIONS.length + ' ta savolni o\'chirishni tasdiqlaysizmi? Bu amalni qaytarib bo\'lmaydi!')) return;
  DEKANAT_QUESTIONS = [];
  saveDekanatQuestions();
  renderDekanatQuestions();
  showToast('🗑️', 'Tozalandi', 'Barcha savollar o\'chirildi', 'red');
}

function saveQuestionModal() {
  var subj = document.getElementById('qModalSubject').value;
  var type = document.getElementById('qModalType').value;
  var text = document.getElementById('qModalText').value.trim();
  var izoh = document.getElementById('qModalIzoh').value.trim();
  var opts = [
    document.getElementById('qOpt0').value.trim(),
    document.getElementById('qOpt1').value.trim(),
    document.getElementById('qOpt2').value.trim(),
    document.getElementById('qOpt3').value.trim()
  ];
  var ansRadio = document.querySelector('input[name="qModalCorrect"]:checked');
  var ans = ansRadio ? parseInt(ansRadio.value) : 0;

  if (!text) { showToast('⚠️', 'Xato', 'Savol matnini kiriting!'); return; }
  if (opts.some(function(o) { return !o; })) { showToast('⚠️', 'Xato', 'Barcha 4 ta variantni kiriting!'); return; }

  if (_editingQId !== null) {
    var q = DEKANAT_QUESTIONS.find(function(x) { return x.id === _editingQId; });
    if (q) { q.subject = subj; q.type = type; q.q = text; q.opts = opts; q.ans = ans; q.izoh = izoh; }
    showToast('✅', 'Yangilandi', 'Savol muvaffaqiyatli yangilandi', 'green');
  } else {
    var newId = DEKANAT_QUESTIONS.length > 0 ? Math.max.apply(null, DEKANAT_QUESTIONS.map(function(q) { return q.id; })) + 1 : 1;
    DEKANAT_QUESTIONS.push({ id: newId, subject: subj, type: type, q: text, opts: opts, ans: ans, izoh: izoh });
    showToast('✅', 'Saqlandi', 'Yangi savol qo\'shildi', 'green');
  }

  saveDekanatQuestions();
  closeQuestionModal();
  renderDekanatQuestions();
}

function closeQuestionModal() {
  document.getElementById('addQuestionModal').style.display = 'none';
  _editingQId = null;
}

// Auto-save APPLICATIONS after push (monkey-patch submitEtiraz)
var _origSubmitEtiraz = submitEtiraz;
submitEtiraz = function(qi) {
  _origSubmitEtiraz(qi);
  saveApplications();
};
var _origSubmitRealEtiraz = submitRealEtiraz;
submitRealEtiraz = function(qi) {
  _origSubmitRealEtiraz(qi);
  saveApplications();
};

// Patch applyFromDetail and orderCert to also save
setTimeout(function() {
  var origApply = window.applyFromDetail;
  if (origApply) window.applyFromDetail = function() { origApply.apply(this, arguments); saveApplications(); };
  var origJobDirect = window.applyJobDirect;
  if (origJobDirect) window.applyJobDirect = function() { origJobDirect.apply(this, arguments); saveApplications(); };
}, 500);

