(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.APP_LOGIC = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Chinese navigation labels; the catalogue keeps each original source name.
  const ACADEMIC_NAME_ZH = {
    "Faculty of Architecture": "建筑学院",
    "Department of Architecture": "建筑学系",
    "Department of Real Estate and Construction": "房地产及建设系",
    "Department of Urban Planning and Design": "城市规划及设计系",
    "Division of Landscape Architecture": "园境建筑学部",
    "Faculty of Arts": "文学院",
    "School of Chinese": "中文学院",
    "School of English": "英文学院",
    "School of Humanities": "人文学院",
    "School of Modern Languages and Cultures": "现代语言及文化学院",
    "Centre of Buddhist Studies": "佛教研究中心",
    "Comparative Literature": "比较文学",
    "Art History": "艺术史",
    "History": "历史",
    "Linguistics": "语言学",
    "Music": "音乐",
    "Philosophy": "哲学",
    "Gender Studies": "性别研究",
    "HKU Business School": "港大经管学院",
    "Accounting and Law": "会计与法律",
    "Economics": "经济学",
    "Finance": "金融学",
    "Innovation and Information Management": "创新与信息管理",
    "Management and Strategy": "管理与策略",
    "Marketing": "市场营销",
    "Faculty of Dentistry": "牙医学院",
    "Applied Oral Sciences & Community Dental Care": "应用口腔科学与社区牙科",
    "Oral & Maxillofacial Surgery": "口腔颌面外科",
    "Paediatric Dentistry & Orthodontics": "儿童牙科与牙齿矫正",
    "Periodontology & Implant Dentistry": "牙周病与口腔种植",
    "Restorative Dental Sciences": "口腔修复科学",
    "Faculty of Education": "教育学院",
    "Language and Literacy Education (LALE)": "语文研究与教育学部",
    "Human Communication, Learning, and Development (HCLD)": "沟通、学习与发展学部",
    "Mathematics, Science, and Technology (MST)": "数学、科学与科技学部",
    "Social Contexts and Policies of Education (SCAPE)": "教育政策与社会学部",
    "Faculty of Engineering": "工程学院",
    "Department of Civil Engineering": "土木工程系",
    "School of Computing & Data Science": "计算与数据科学学院",
    "Department of Data and Systems Engineering": "数据与系统工程系",
    "Department of Electrical and Computer Engineering": "电机与计算机工程系",
    "School of Innovation": "创新学院",
    "Department of Materials and Energy": "材料与能源系",
    "Department of Mechanical Engineering": "机械工程系",
    "School of Biomedical Engineering": "生物医学工程学院",
    "Faculty of Law": "法律学院",
    "Li Ka Shing Faculty of Medicine": "李嘉诚医学院",
    "School of Biomedical Sciences": "生物医学学院",
    "School of Chinese Medicine": "中医药学院",
    "School of Clinical Medicine": "临床医学学院",
    "School of Nursing": "护理学院",
    "Department of Pharmacology and Pharmacy": "药理及药剂学系",
    "School of Public Health": "公共卫生学院",
    "Centre of Cancer Medicine": "癌症医学中心",
    "Critical Care Medicine Unit": "深切治疗医学部",
    "Department of Anaesthesiology": "麻醉学系",
    "Department of Clinical Oncology (Founding Member of Centre of Cancer Medicine)": "临床肿瘤学系（癌症医学中心创始成员）",
    "Department of Diagnostic Radiology": "放射诊断学系",
    "Department of Emergency Medicine": "急症医学系",
    "Department of Family Medicine and Primary Care": "家庭医学及基层医疗学系",
    "Department of Medicine": "内科学系",
    "Department of Microbiology": "微生物学系",
    "Department of Obstetrics and Gynaecology": "妇产科学系",
    "Department of Ophthalmology": "眼科学系",
    "Department of Orthopaedics and Traumatology": "骨科及创伤学系",
    "Department of Paediatrics and Adolescent Medicine": "儿童及青少年科学系",
    "Department of Pathology": "病理学系",
    "Department of Psychiatry": "精神医学系",
    "Department of Surgery": "外科学系",
    "Medical Ethics and Humanities Unit": "医学伦理及人文学部",
    "Faculty of Science": "理学院",
    "School of Biological Sciences": "生物科学学院",
    "Department of Chemistry": "化学系",
    "Department of Earth and Planetary Sciences": "地球与行星科学系",
    "Department of Mathematics": "数学系",
    "Department of Physics": "物理学系",
    "School of Computing and Data Science": "计算与数据科学学院",
    "Department of AI & Data Science": "人工智能与数据科学系",
    "Department of Computer Science": "计算机科学系",
    "Department of Statistics & Actuarial Science": "统计及精算学系",
    "Department of AI and Data Science": "人工智能与数据科学系",
    "Department of Statistics and Actuarial Science": "统计及精算学系",
    "Institute of Mathematical Research (IMR)": "数学研究所",
    "Laboratory for Space Research (LSR)": "太空研究实验室",
    "The Swire Institute of Marine Science (SWIMS)": "太古海洋科学研究所",
    "Faculty of Social Sciences": "社会科学学院",
    "Department of Geography": "地理学系",
    "Department of Politics and Public Administration": "政治与公共行政学系",
    "Department of Psychology": "心理学系",
    "Department of Social Work and Social Administration": "社会工作及社会行政学系",
    "Department of Sociology": "社会学系",
    "School of Governance and Policy": "治理与政策学院",
    "School of Future Media": "未来媒体学院",
    "Department of Anthropology": "人类学系",
    "Department of Chinese Language and Literature": "中国语言及文学系",
    "Department of Cultural and Religious Studies": "文化及宗教研究系",
    "Department of English": "英语系",
    "Department of Fine Arts": "艺术系",
    "Department of History": "历史系",
    "Department of Japanese Studies": "日本研究学系",
    "Department of Linguistics and Modern Languages": "语言学及现代语言系",
    "Department of Music": "音乐系",
    "Department of Philosophy": "哲学系",
    "Department of Translation": "翻译系",
    "Centre for China Studies": "中国研究中心",
    "English Language Teaching Unit": "英语教学单位",
    "Yale-China Chinese Language Academy": "雅礼中国语文研习所",
    "Faculty of Business Administration": "工商管理学院",
    "Department of Decisions, Operations and Technology": "决策、运营与科技学系",
    "Department of Finance": "金融学系",
    "School of Hotel and Tourism Management": "酒店及旅游管理学院",
    "Department of Management": "管理学系",
    "Department of Marketing": "市场营销学系",
    "The School of Accountancy": "会计学院",
    "The Asia-Pacific Institute of Business (APIB)": "亚太工商研究所",
    "Department of Curriculum and Instruction": "课程与教学学系",
    "Department of Educational Administration and Policy": "教育行政与政策学系",
    "Department of Educational Psychology": "教育心理学系",
    "Department of Sports Science and Physical Education": "体育运动科学系",
    "Physical Education Unit": "体育部",
    "Department of Biomedical Engineering": "生物医学工程系",
    "Department of Computer Science and Engineering": "计算机科学与工程系",
    "Department of Electronic Engineering": "电子工程系",
    "Department of Information Engineering": "信息工程系",
    "Department of Mechanical and Automation Engineering": "机械与自动化工程学系",
    "Department of Systems Engineering and Engineering Management": "系统工程与工程管理学系",
    "Faculty of Medicine": "医学院",
    "Accident and Emergency Medicine Academic Unit": "急症医学教研单位",
    "Department of Anaesthesia and Intensive Care": "麻醉及深切治疗学系",
    "Department of Anatomical and Cellular Pathology": "解剖及细胞病理学系",
    "Department of Chemical Pathology": "化学病理学系",
    "Department of Clinical Oncology": "临床肿瘤学系",
    "Department of Imaging and Interventional Radiology": "影像及介入放射学系",
    "Department of Medicine and Therapeutics": "内科及药物治疗学系",
    "Department of Ophthalmology and Visual Sciences": "眼科及视觉科学学系",
    "Department of Otorhinolaryngology, Head and Neck Surgery": "耳鼻咽喉头颈外科学系",
    "Department of Paediatrics": "儿科学系",
    "School of Pharmacy": "药剂学院",
    "The Nethersole School of Nursing": "雅丽氏何妙龄那打素护理学院",
    "The Jockey Club School of Public Health and Primary Care": "赛马会公共卫生及基层医疗学院",
    "Department of Earth and Environmental Sciences": "地球与环境科学系",
    "School of Life Sciences": "生命科学学院",
    "Department of Statistics and Data Science": "统计与数据科学系",
    "Faculty of Social Science": "社会科学学院",
    "School of Architecture": "建筑学院",
    "Department of Economics": "经济学系",
    "Department of Geography and Resource Management": "地理与资源管理学系",
    "School of Governance and Policy Science": "治理与政策科学学院",
    "School of Journalism and Communication": "新闻与传播学院",
    "Department of Social Work": "社会工作学系",
    "Zhizhen School of Interdisciplinary Mathematical Sciences": "致真交叉数学科学学院",
    "Basic and Applied Mathematics": "基础与应用数学",
    "Physics": "物理学",
    "Computer Science": "计算机科学",
    "Artificial Intelligence": "人工智能",
    "Big Data Processing": "大数据处理",
    "Machine Learning": "机器学习",
    "Graduate School": "研究生院",
    "School of Science": "理学院",
    "School of Engineering": "工学院",
    "Department of Chemical and Biological Engineering": "化学及生物工程学系",
    "Department of Civil and Environmental Engineering": "土木及环境工程学系",
    "Department of Electronic and Computer Engineering": "电子及计算机工程学系",
    "Department of Industrial Engineering and Decision Analytics": "工业工程及决策分析学系",
    "Department of Mechanical and Aerospace Engineering": "机械及航空航天工程学系",
    "Department of Materials": "材料学系",
    "School of Business and Management": "工商管理学院",
    "Department of Accounting": "会计学系",
    "Department of Information Systems, Business Statistics & Operations Management": "信息、商业统计及运营管理学系",
    "School of Humanities and Social Science": "人文社会科学学院",
    "Division of Humanities": "人文学部",
    "Division of Social Science": "社会科学学部",
    "Center for Language Education": "语言教育中心",
    "Center for Chinese Linguistics": "中国语言学研究中心",
    "The South China Research Center": "华南研究中心",
    "The Global China Center": "全球中国研究中心",
    "School of Medicine": "医学院",
    "Academy of Interdisciplinary Studies": "跨学科学院",
    "Division of Arts and Machine Creativity": "艺术与机器创造力学部",
    "Division of Emerging Interdisciplinary Areas": "新兴跨学科领域学部",
    "Division of Environment & Sustainability": "环境及可持续发展学部",
    "Division of Integrative Systems and Design": "综合系统与设计学部",
    "Division of Public Policy": "公共政策学部",
    "MPhil / PhD · Arts and Machine Creativity": "艺术与机器创造力研究型硕博",
    "MPhil / PhD · Atmospheric Environmental Science": "大气环境科学研究型硕博",
    "MPhil / PhD · Environmental Science, Policy and Management": "环境科学、政策与管理研究型硕博",
    "MPhil / PhD · Individualized Interdisciplinary Program": "个性化跨学科研究型硕博",
    "MPhil / PhD · Integrative Systems and Design": "综合系统与设计研究型硕博",
    "MPhil / PhD · Public Policy": "公共政策研究型硕博",
    "MPhil · Technology Innovation and Entrepreneurship": "科技创新与创业研究型硕士",
    "Department of Chemical and Biological Engineering (CBE)": "化学及生物工程学系",
    "Department of Civil and Environmental Engineering (CIVL)": "土木及环境工程学系",
    "Department of Computer Science and Engineering (CSE)": "计算机科学与工程系",
    "Department of Electronic and Computer Engineering (ECE)": "电子及计算机工程学系",
    "Department of Industrial Engineering and Decision Analytics (IEDA)": "工业工程及决策分析学系",
    "Department of Information Systems, Business Statistics and Operations Management": "信息、商业统计及运营管理学系",
    "Department of Mechanical and Aerospace Engineering (MAE)": "机械及航空航天工程学系",
    "Department of Ocean Science": "海洋科学系",
    "Division of Integrative Systems and Design (ISD)": "综合系统与设计学部",
    "Division of Life Science": "生命科学学部",
    "Faculty of Business": "商学院",
    "Department of Logistics and Maritime Studies": "物流及航运学系",
    "Department of Management and Marketing": "管理及市场学系",
    "School of Accounting and Finance": "会计及金融学院",
    "Faculty of Computer and Mathematical Sciences": "计算机及数学科学学院",
    "Department of Applied Mathematics": "应用数学系",
    "Department of Computing": "计算学系",
    "Department of Data Science and Artificial Intelligence": "数据科学及人工智能学系",
    "Faculty of Construction and Environment": "建设及环境学院",
    "Department of Building Environment and Energy Engineering": "建筑环境及能源工程学系",
    "Department of Construction Management and Intelligence": "建筑管理与智能化学系",
    "Department of Land Surveying and Geospatial Science": "土地测量及地理空间科学系",
    "Department of Aeronautical and Aviation Engineering": "航空及民航工程学系",
    "Department of Biomedical Engineering and Sports Technology": "生物医学工程与运动科技学系",
    "Department of Electrical and Electronic Engineering": "电机及电子工程学系",
    "Department of Industrial and Systems Engineering": "工业及系统工程学系",
    "Faculty of Health and Social Sciences": "医疗及社会科学院",
    "Department of Applied Social Sciences": "应用社会科学系",
    "Department of Health Technology and Informatics": "医疗科技及信息学系",
    "Department of Rehabilitation Sciences": "康复治疗科学系",
    "School of Optometry": "眼科视光学院",
    "Faculty of Humanities": "人文学院",
    "Department of Chinese History and Culture": "中国历史及文化学系",
    "Department of English and Communication": "英语及传意学系",
    "Department of Language Science and Technology": "语言科学及科技学系",
    "Division of Artificial Intelligence and the Humanities": "人工智能与人文学部",
    "Department of Food Science and Nutrition": "食品科学及营养学系",
    "Department of Life Sciences": "生命科学系",
    "Department of Physics and Materials": "物理及材料学系",
    "School of Design": "设计学院",
    "PolyU Research Centre for Cultural and Art Technology": "理大文化艺术科技研究中心",
    "Research Centre for Future (Caring) Mobility": "未来出行（关爱）研究中心",
    "POLYU-NVIDIA Joint Research Centre": "理大—英伟达联合研究中心",
    "Asian Ergonomics Design Lab": "亚洲人体工学设计实验室",
    "Asian Lifestyle Design Lab": "亚洲生活方式设计实验室",
    "Creativity and Design Education Lab": "创意与设计教育实验室",
    "Information Design Lab": "信息设计实验室",
    "Interaction Design Lab": "交互设计实验室",
    "Public Design Lab": "公共设计实验室",
    "Research Institute of Design-driven Entrepreneurship": "设计驱动创业研究所",
    "Research Laboratory for Advanced Social Robotics": "先进社交机器人研究实验室",
    "School of Fashion and Textiles": "时装及纺织学院",
    "Fashion and Textile Technology": "时装及纺织科技",
    "Fashion and Textile Design": "时装及纺织设计",
    "Fashion Business": "时装商业",
    "Research Centre of Textiles for Future Fashion": "未来时装及纺织研究中心",
    "Research Institute for Sports Science and Technology": "体育科技研究所",
    "Research Institute for Intelligent Wearable Systems": "智能可穿戴系统研究所",
    "Joint-Research Centre for Fiber Innovations and Renewable Materials": "纤维创新与可再生材料联合研究中心",
    "Laboratory for Artificial Intelligence in Design": "人工智能设计实验室",
    "Hospitality and Tourism Research Centre": "酒店及旅游业研究中心",
    "Research Centre for Digital Transformation of Tourism": "旅游业数字化转型研究中心",
    "College of Undergraduate Studies": "本科生院",
    "College of Biomedicine": "生物医学院",
    "Department of Biomedical Sciences": "生物医学系",
    "Department of Neuroscience": "神经科学系",
    "College of Business": "商学院",
    "Department of Accountancy": "会计学系",
    "Department of Decision Analytics and Operations": "决策分析及运营学系",
    "Department of Economics and Finance": "经济及金融学系",
    "Department of Information Systems": "信息系统学系",
    "College of Computing": "计算机学院",
    "Department of Biostatistics": "生物统计学系",
    "Department of Data Science": "数据科学系",
    "College of Engineering": "工程学院",
    "Department of Architecture and Civil Engineering": "建筑学及土木工程学系",
    "Department of Electrical Engineering": "电机工程学系",
    "Department of Materials Science and Engineering": "材料科学及工程学系",
    "Department of Systems Engineering": "系统工程学系",
    "College of Liberal Arts and Social Sciences": "人文社会科学院",
    "Department of Chinese and History": "中文及历史学系",
    "Department of Linguistics and Translation": "语言学及翻译学系",
    "Department of Media and Communication": "媒体与传播学系",
    "Department of Public and International Affairs": "公共及国际事务学系",
    "Department of Social and Behavioural Sciences": "社会及行为科学系",
    "College of Science": "理学院",
    "Jockey Club College of Veterinary Medicine and Life Sciences": "赛马会动物医学及生命科学院",
    "Department of Infectious Diseases and Public Health": "传染病及公共卫生学系",
    "Department of Veterinary Clinical Sciences": "兽医临床学系",
    "School of Creative Media": "创意媒体学院",
    "School of Energy and Environment": "能源及环境学院",
    "School of Law": "法学院",
    "Chow Yei Ching School of Graduate Studies": "周亦卿研究生院",
    "CityUHK Academy of Innovation": "城大创新学院",
    "AI / interdisciplinary thrusts (as stated on prospective page)": "人工智能及跨学科学域（见招生介绍）",
    "Computer Science and Engineering": "计算机科学与工程学系",
    "Computer Science and Engineering；Electronic and Computer Engineering": "计算机科学与工程学系；电子及计算机工程学系",
    "Department of Data Science；Affiliate, Department of Biostatistics": "数据科学系；兼任生物统计学系",
    "Department of Electrical Engineering; Department of Computer Science (Affiliate)": "电机工程学系；兼任计算机科学系",
    "Electronic and Computer Engineering": "电子及计算机工程学系",
    "Information Hub / Artificial Intelligence Thrust": "信息枢纽 · 人工智能学域",
    "Information Hub / Computational Media and Arts Thrust": "信息枢纽 · 计算媒体与艺术学域",
    "Information Hub / Computational Media and Arts Thrust；Artificial Intelligence Thrust": "信息枢纽 · 计算媒体与艺术学域；人工智能学域",
    "Information Hub / Computational Media and Arts Thrust；Internet of Things Thrust": "信息枢纽 · 计算媒体与艺术学域；物联网学域",
    "School of Artificial Intelligence": "人工智能学院",
    "School of Data Science": "数据科学学院",
    "School of Science and Engineering": "理工学院",
    "School of Science and Engineering；School of Artificial Intelligence": "理工学院；人工智能学院",
    "Systems Hub / Intelligent Transportation Thrust；Robotics and Autonomous Systems Thrust": "系统枢纽 · 智能交通学域；机器人与自主系统学域",
    "Systems Hub / Robotics and Autonomous Systems Thrust": "系统枢纽 · 机器人与自主系统学域",
    "Thrust of Financial Technology": "金融科技学域"
  };
  function academicChineseName(name) { return Object.hasOwn(ACADEMIC_NAME_ZH,name)?ACADEMIC_NAME_ZH[name]:name; }
  function academicLabel(name) { const zh=academicChineseName(name);return zh===name?name:zh+' · '+name; }
  const INTERESTS = ['人工智能','机器学习','计算机视觉','自然语言处理','机器人与控制','数据挖掘','网络与系统','理论与优化','数学与统计','金融与精算','生物医学与健康','软件工程与编程语言','网络安全','人机交互','数据库与数据系统','计算机图形学','计算机音乐与音频','环境与可持续发展','物理与化学','材料与能源','土木与机械工程','经济与管理','人文与社会科学','教育学','设计与创意','旅游与酒店管理','电子与集成电路','生命科学与生物工程','化学工程'];
  const KEYWORDS = [
    /人工智能|artificial intelligence|(?:^|\W)ai(?:$|\W)|ai4science/i,
    /机器学习|深度学习|machine learning|deep learning|distributed learning|reinforcement learning/i,
    /计算机视觉|视觉|computer vision|image|vision/i,
    /自然语言|语言处理|natural language|(?:^|\W)nlp(?:$|\W)|speech|language model/i,
    /机器人|控制|robot|control|autonomous|multi.agent|cyber.physical/i,
    /数据挖掘|data mining|data science|analytics|recommendation/i,
    /网络|系统|network|systems|computing|security|internet|iot/i,
    /理论|优化|theory|optimization|game|mathematics/i,
    /数学|统计|math|statistic/i,
    /金融|精算|financ|fintech|actuari/i,
    /生物医学|健康|biomed|health/i,
    /软件工程|编程语言|software engineering|programming languages/i,
    /网络安全|cybersecurity|security|cryptograph/i,
    /人机交互|human.computer|human.ai interaction/i,
    /数据库|数据系统|database|data systems/i,
    /计算机图形学|computer graphics/i,
    /计算机音乐|音频|computer music|audio/i,
    /环境|可持续|environment|sustainab|climate/i,
    /物理|化学|physics|chemistry/i,
    /材料|能源|materials|energy/i,
    /土木|机械工程|civil engineering|mechanical engineering/i,
    /经济|管理|economics|management/i,
    /人文|社会科学|humanities|social sciences/i,
    /教育|education/i,
    /设计|创意|design|creative/i,
    /旅游|酒店|tourism|hospitality/i,
    /集成电路|微电子|半导体|芯片|integrated circuit|microelectronic|semiconductor|vlsi|photonic|electronic design automation/i,
    /生命科学|生物工程|life science|bioengineering|genomics|genetics|synthetic biology/i,
    /化学工程|化工|chemical engineering|chemical process|process control/i
  ];
  const OFFICIAL_HOSTS = ['hku.hk','cuhk.edu.hk','hkust.edu.hk','ust.hk','polyu.edu.hk','cityu.edu.hk','cuhk.edu.cn','hkust-gz.edu.cn','ugc.edu.hk','rgc.edu.hk'];
  const EDUCATION = ['','undergraduate','bachelor','master','other'];
  const ENGLISH = ['','planning','scheduled','available','exemption'];
  const RESEARCH_ALIASES = [
    ['多模态','multimodal','multi-modal'],['多模态大模型','multimodal large language models','multimodal language models'],
    ['人工智能','artificial intelligence','ai'],['自动化','automation'],
    ['机器人','robot','robotics'],['控制','control'],['网络化控制','networked control'],['智能控制','intelligent control'],
    ['自适应控制','adaptive control'],['强化学习','reinforcement learning','rl'],['多智能体','multi-agent','multiagent'],
    ['具身智能','embodied ai','embodied intelligence'],['无人机','uav','unmanned aerial vehicle'],
    ['机器学习','machine learning'],['深度学习','deep learning'],['迁移学习','transfer learning'],
    ['图机器学习','graph machine learning'],['推荐系统','recommendation','recommender systems'],
    ['计算机视觉','computer vision'],['三维重建','3d reconstruction'],['自然语言处理','natural language processing','nlp'],
    ['大语言模型','large language models','large language model','llm','llms'],['数据挖掘','data mining'],
    ['分布式系统','distributed systems'],['分布式机器学习','distributed machine learning'],['优化','optimization'],
    ['统计','统计学','statistics','statistical'],['概率','概率论','probability'],['贝叶斯','bayesian'],
    ['因果推断','causal inference'],['时间序列','time series'],['随机矩阵','random matrices','random matrix theory'],
    ['金融科技','financial technology','fintech'],['量化金融','quantitative finance'],['金融工程','financial engineering'],
    ['风险管理','risk management'],['生存分析','survival analysis'],['精准医疗','precision medicine'],
    ['软件工程','software engineering'],['编程语言','programming languages'],['程序分析','program analysis'],
    ['人机交互','human-computer interaction','human computer interaction'],['可视化','visualization'],
    ['数据库','database','databases'],['网络安全','cybersecurity','network security'],
    ['密码学','cryptography'],['差分隐私','differential privacy'],['计算机图形学','computer graphics'],
    ['可持续发展','可持续性','sustainability','sustainable development'],['气候变化','climate change'],
    ['空气污染','air pollution'],['环境工程','environmental engineering'],['可再生能源','renewable energy'],
    ['旅游','tourism'],['酒店管理','hospitality management','hotel management'],['旅游经济学','tourism economics'],
    ['消费者行为','consumer behavior','consumer behaviour'],['目的地营销','destination marketing'],
    ['设计','design'],['教育','education'],['公共政策','public policy'],
    ['计算机音乐','computer music'],['音频工程','audio engineering'],
    ['集成电路','integrated circuits','integrated circuit','ic design'],['微电子','microelectronics','microelectronic'],
    ['电子设计自动化','electronic design automation','eda'],['硬件安全','hardware security'],
    ['芯片设计','chip design','vlsi design'],['半导体','semiconductor','semiconductors'],
    ['光子集成电路','photonic integrated circuits'],['光子计算','photonic computing'],
    ['大气化学','atmospheric chemistry'],['空气质量','air quality'],['储能','energy storage'],
    ['固态电池','solid-state batteries','solid state batteries'],['钙钛矿','perovskite','perovskites'],
    ['医学图像分析','医学影像分析','medical image analysis'],['图算法','graph algorithms'],
    ['精算','精算学','actuarial science'],['量子计算','quantum computing','quantum computation'],
    ['量子信息','quantum information'],['量子密码','quantum cryptography'],
    ['医疗ai','medical ai','ai in healthcare','ai for healthcare'],['学习分析','learning analytics'],
    ['联邦学习','federated learning'],['随机控制','stochastic control','stochastic controls'],
    ['量子信息与控制','量子控制','quantum information and control','quantum control'],
    ['数学金融','mathematical finance','financial mathematics'],
    ['后量子密码学','后量子密码','post-quantum cryptography','post quantum cryptography'],
    ['图检索增强生成','图rag','graph retrieval-augmented generation','graph rag'],
    ['超大规模集成电路','vlsi'],
    ['合成生物学','synthetic biology'],['生物信息学','bioinformatics'],
    ['过程控制','process control'],['电催化','electrocatalysis'],
    ['膜技术','membrane technology','membrane technologies'],
    ['可穿戴电子','wearable electronics'],['科学智能','ai辅助科学研究','ai for science']
  ];
  function officialUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') && OFFICIAL_HOSTS.some(h => url.hostname === h || url.hostname.endsWith('.'+h)) ? url.href : null; }
    catch (_) { return null; }
  }
  function defaultProfile(catalog) { return {degree:'MPhil',cycle:catalog?catalog.cycle:'',universityIds:[],interests:[],researchQuery:'',education:'',english:'',gpaNote:''}; }
  function publicHttps(value) {
    try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')?u.href:null;}catch(_){return null;}
  }
  function sourceUrl(catalog,source) {
    const target=publicHttps(source.url);if(!target)return null;
    const seen=new Set();let current=source;
    for(let depth=0;depth<16;depth++){
      if(seen.has(current.id))return null;seen.add(current.id);
      if(officialUrl(current.url))return target;
      if(!publicHttps(current.url)||current.evidenceLevel!=='teacher_page_linked_from_official_profile')return null;
      const parent=catalog.sources.find(s=>s.id===current.parentSourceId);if(!parent)return null;
      const links=parent.discoveredLinks||[];
      if(!links.includes(current.url)&&!(current.originalUrl&&current.retrievedUrl===current.url&&links.includes(current.originalUrl)))return null;
      current=parent;
    }
    return null;
  }
  function facultyLinks(catalog,faculty) {
    return (faculty.extraLinks||[]).flatMap(item=>{
      const parent=catalog.sources.find(s=>s.id===item.parentSourceId);
      let url=publicHttps(item.url);
      const fromProfile=parent&&[faculty.profileUrl,faculty.reviewedProfileUrl].filter(Boolean).includes(parent.url);
      const fromDirectory=parent&&(faculty.directorySourceIds||[]).includes(parent.id)&&
        (parent.teacherLinksByProfile?.[faculty.profileUrl]||[]).includes(item.url);
      if(!parent||!sourceUrl(catalog,parent)||(!fromProfile&&!fromDirectory)||
        !faculty.sourceIds.includes(parent.id)||!(parent.discoveredLinks||[]).includes(item.url))return [];
      if(!url&&item.bodyStatus==='body_read'&&item.sourceId&&faculty.sourceIds.includes(item.sourceId)){
        const read=catalog.sources.find(s=>s.id===item.sourceId);
        if(read&&read.evidenceLevel==='teacher_page_linked_from_official_profile'&&read.parentSourceId===parent.id&&
          read.originalUrl===item.url&&read.retrievedUrl===read.url)url=publicHttps(read.url);
      }
      if(!url)return [];
      return [{...item,url}];
    });
  }
  function observedProfileUrl(catalog,url,sourceIds) {
    const own=officialUrl(url);if(own)return own;
    const safe=publicHttps(url);if(!safe)return null;
    return (sourceIds||[]).some(id=>{
      const parent=catalog.sources.find(s=>s.id===id);
      return parent&&officialUrl(parent.url)&&(parent.discoveredLinks||[]).includes(url);
    })?safe:null;
  }
  function facultyLinkSections(items) {
    const generic=new Set(['个人页所给链接','个人页提供的链接','个人主页或课题组','个人或实验室网站','查看本人主页所给网站','Personal Website','Personal Homepage','个人网站或研究档案','个人或研究组主页','个人或课题组网站','官网提供的个人或实验室主页','个人网站与研究资料','个人或学系研究主页','院系所给个人或研究资料','院系提供的个人网站或研究主页']);
    const archives=/^(scholar\.google\.|researchgate\.net$|scopus\.com$|orcid\.org$|publons\.com$|webofscience\.|research\.polyu\.edu\.hk$)/;
    const publications=/(^|\.)(doi\.org|arxiv\.org|sciencedirect\.com|nature\.com|springer\.com|wiley\.com|mdpi\.com|frontiersin\.org|elsevier\.com|digitalcommonsdata\.com)$/;
    const decorated=items.map((item,index)=>{
      const url=new URL(item.url),host=url.hostname.replace(/^www\./,''),last=url.pathname.split('/').filter(Boolean).at(-1)||'';
      let label=item.label;
      if(!label||generic.has(label)){
        if(host.startsWith('scholar.google.'))label='Google Scholar';
        else if(host==='research.polyu.edu.hk')label='港理工研究档案';
        else if(host==='scopus.com')label='Scopus';
        else if(host==='researchgate.net')label='ResearchGate';
        else if(host==='orcid.org')label='ORCID';
        else {
          let tail;try{tail=decodeURIComponent(last);}catch(_){tail=last;}
          label=host+((last&&!/^index\.(html?|php)$/i.test(last))?' · '+(tail.length>48?tail.slice(0,45)+'…':tail):'');
        }
      }
      return {...item,label,index,archive:archives.test(host)||publications.test(host)};
    });
    // Keep every supplied URL; prioritize readable homepages before long reference lists.
    const candidates=decorated.filter(x=>x.kind!=='shared_navigation');
    const ordered=[...candidates.filter(x=>!x.archive&&x.bodyStatus==='body_read'),...candidates.filter(x=>!x.archive&&x.bodyStatus!=='body_read'),...candidates.filter(x=>x.archive)];
    const primary=ordered.slice(0,6),chosen=new Set(primary.map(x=>x.index));
    return {primary,more:decorated.filter(x=>!chosen.has(x.index))};
  }
  function directoryResearchSource(catalog,faculty) {
    if(faculty.recordKind!=='directory_research'||faculty.profileUrl!==null)return null;
    const id=faculty.directoryEvidenceSourceId;
    if(!(faculty.sourceIds||[]).includes(id)||!(faculty.directorySourceIds||[]).includes(id))return null;
    const source=catalog.sources.find(s=>s.id===id);
    if(!source||!officialUrl(source.url))return null;
    const directory=(catalog.directories||[]).find(d=>d.universityId===faculty.universityId&&d.url===source.url&&d.sourceIds.includes(id)&&
      (d.census?.unlinkedEntries||[]).some(row=>row.facultyId===faculty.id&&row.name===faculty.name));
    return directory?source:null;
  }
  function cyclesFor(catalog) { return [...new Set([catalog.cycle,...catalog.programs.flatMap(p=>[p.cycle,...(p.deadlines||[]).map(d=>d.cycle)])].filter(Boolean))]; }
  function cycleLabel(value) { const spring=/^(\d{4}\/\d{2}) Spring$/.exec(value||'');return !value?'先看全部已核轮次':spring?(Number(spring[1].slice(0,4))+1)+'年春季（'+spring[1]+'学年）':value+'学年'; }
  function matchedTopics(faculty, interests) {
    return interests.filter(tag => INTERESTS.includes(tag) && (faculty.topics||[]).some(topic=>
      INTERESTS.includes(topic)?topic===tag:KEYWORDS[INTERESTS.indexOf(tag)].test(topic)));
  }
  function applicationDegrees(catalog, program) {
    const route = (catalog.directApplicationRoutes || {})[program.id];
    return route && route.cycle === program.cycle ? route.degrees : (program.degrees || []);
  }
  function programsFor(catalog, profile) {
    return catalog.programs.filter(p => applicationDegrees(catalog, p).includes(profile.degree) &&
      (!profile.universityIds.length || profile.universityIds.includes(p.universityId)) &&
      (!profile.cycle || p.cycleVerified===false || p.cycle===profile.cycle || (p.deadlines||[]).some(d=>d.cycle===profile.cycle&&(!d.degree||d.degree===profile.degree))));
  }
  function facultyFor(catalog, profile) {
    return catalog.faculty.filter(f => (!profile.universityIds.length || profile.universityIds.includes(f.universityId)) &&
      (!profile.interests.length || matchedTopics(f, profile.interests).length) &&
      (!profile.researchQuery?.trim() || matchedResearchTerms(f,profile.researchQuery).length));
  }
  function matchedResearchTerms(faculty,query) {
    if(typeof query!=='string'||!query.trim())return [];
    const normalize=text=>text.normalize('NFKC').toLocaleLowerCase('en-US').trim();
    const queries=[...new Set(query.split(/[,，、;；\n]+/).map(normalize).filter(Boolean))];
    const terms=faculty.researchKeywords?.length?faculty.researchKeywords:(faculty.topics||[]);
    const includes=(term,needle)=>{
      if(/^[a-z0-9\s+.\-]+$/i.test(needle)){
        const escaped=needle.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+');
        return new RegExp('(^|[^a-z0-9])'+escaped+'(?=$|[^a-z0-9])','i').test(term);
      }
      return term.includes(needle);
    };
    return terms.filter(term=>queries.some(q=>{const aliases=RESEARCH_ALIASES.find(group=>group.includes(q))||[q];return aliases.some(alias=>includes(normalize(term),alias));}));
  }
  function directoriesFor(catalog,profile) { return (catalog.directories||[]).filter(d=>!profile.universityIds.length||profile.universityIds.includes(d.universityId)); }
  function reviewedForDirectory(catalog,directory) { return catalog.faculty.filter(f=>(f.directorySourceIds||[]).some(id=>directory.sourceIds.includes(id))).length; }
  function requirementsFor(program, profile) {
    return (program.requirements||[]).filter(item=>!item.degrees||item.degrees.includes(profile.degree));
  }
  function financesFor(program, profile) {
    return (program.finances||[]).filter(item=>!item.degrees||item.degrees.includes(profile.degree));
  }
  function financeRates(item, profile) {
    const year=/^\d{4}\/\d{2}/.exec(profile.cycle||'')?.[0];
    const matches=rate=>!!profile.cycle&&((rate.basis==='intake'&&rate.cycle===profile.cycle)||(rate.basis==='academic_year'&&rate.cycle===year));
    return {matched:(item.rates||[]).filter(matches),reference:(item.rates||[]).filter(rate=>!matches(rate))};
  }
  function financeRateText(rate) {
    const units={academic_year:'学年',year:'年',month:'月',application:'次申请'};
    const scope=rate.basis==='intake'?cycleLabel(rate.cycle)+'入学':rate.basis==='academic_year'?rate.cycle+'学年':'当前网页参考 · 未注明轮次';
    return rate.currency+' '+new Intl.NumberFormat('en-US').format(rate.value)+' / '+units[rate.unit]+' · '+scope+' · '+rate.condition;
  }
  function preparationNote(profile) {
    const parts=[];
    if(profile.education==='undergraduate')parts.push('本科在读可以先整理在读证明、现有成绩单和预计毕业时间；是否接受申请及何时补最终证明，要看具体项目。');
    if(profile.degree==='PhD'&&['undergraduate','bachelor'].includes(profile.education))parts.push('想从本科申请博士，先看本项目是否有相应学历路径；这里不会替学校认定同等资格。');
    if(['planning','scheduled'].includes(profile.english))parts.push('报名或考试前，先核对项目接受的考试形式、单项要求和有效期。已预约不等于可以在截止后补交。');
    if(profile.english==='available')parts.push('已有成绩也要核对考试日期、形式、单项及正式送分要求；本页没有判定成绩是否达标。');
    if(profile.english==='exemption')parts.push('准备走英语授课学历等替代路径时，先核对项目接受哪种证明，再向学校确认。');
    return parts.join(' ');
  }
  function deadlineState(deadline, selectedCycle, now) {
    if (deadline.cycle && selectedCycle && deadline.cycle !== selectedCycle) return {code:'out_of_scope',text:'其他入学轮次，不适用本次筛选'};
    const value=deadline.at || deadline.date;
    if (!value) return {code:'unknown',text:'时间待核实，不能据此判断申请开放'};
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d(?:T.*(?:Z|[+-]\d\d:\d\d))?$/.test(value)) return {code:'unknown',text:'日期格式待核实'};
    const current = now === undefined ? Date.now() : +new Date(now);
    if (/^\d{4}-\d\d-\d\d$/.test(value)) {
      if (!Number.isFinite(current)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value) return {code:'unknown',text:'日期待核实'};
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(current);
      const pick=kind=>parts.find(part=>part.type===kind).value;
      const today=pick('year')+'-'+pick('month')+'-'+pick('day');
      return value<today ? {code:'expired',text:'这个日期已过，请查下一轮安排'} : {code:'date_only',text:'官网只写了日期，具体几点截止还需核对'};
    }
    const stamp = Date.parse(value);
    if (!Number.isFinite(stamp) || !Number.isFinite(current)) return {code:'unknown',text:'时间待核实'};
    return stamp < current ? {code:'expired',text:'这个日期已过，请查下一轮安排'} : {code:'dated',text:'官方页面列出此日期；开放状态仍请核对原页'};
  }
  function isHongKongUniversity(university) {
    const identity = [university.id,university.name,university.short,university.en,university.region].join(' ');
    if (/深圳|广州|shenzhen|guangzhou|hkust.?gz|cuhk.?sz/i.test(identity)) return false;
    return /香港|hong kong/i.test(identity) && /hku|cuhk|hkust|polyu|cityu|香港大學|香港大学|香港中文|香港科技|香港理工|香港城市/i.test(identity);
  }
  function fundingFor(catalog, profile) {
    if (profile.degree !== 'PhD') return [];
    const ids = catalog.universities.filter(u => isHongKongUniversity(u) &&
      (!profile.universityIds.length || profile.universityIds.includes(u.id))).map(u=>u.id);
    return (catalog.funding || []).filter(f => f.degree === 'PhD' && (!profile.cycle||f.cycle===profile.cycle) && (f.universities || []).some(id=>ids.includes(id)));
  }
  function deadlinesFor(program, profile, university) {
    return (program.deadlines||[]).filter(d=>(!d.degree || d.degree===profile.degree) && (!profile.cycle||(d.cycle||program.cycle)===profile.cycle) &&
      (!/hkpfs/i.test([d.route,d.label].join(' ')) || (profile.degree==='PhD' && university && isHongKongUniversity(university))));
  }
  function availabilityText(faculty) {
    const availability=faculty.availability || {};
    return availability.state === 'advertised' ? '页面有招生说明；是否仍有名额，需进一步确认。' : '当前名额未知，不等于不招生。';
  }
  function text(value, max, field) {
    if (typeof value !== 'string' || value.length > max) throw new Error(field+'格式或长度不符合要求。');
    return value;
  }
  function ids(value, allowed, field) {
    if (!Array.isArray(value) || value.length > allowed.length || new Set(value).size !== value.length || value.some(id=>!allowed.includes(id))) throw new Error(field+'中有当前资料不认识的编号，请保留原文件并核对版本。');
    return value.slice();
  }
  function normalizeProfile(value, catalog) {
    if (!value || !['MPhil','PhD'].includes(value.degree) || !EDUCATION.includes(value.education) || !ENGLISH.includes(value.english)) throw new Error('个人选择格式不正确。');
    const cycle=value.cycle===undefined?'':value.cycle;
    if(typeof cycle!=='string'||(cycle!==''&&!cyclesFor(catalog).includes(cycle)))throw new Error('这份备份的入学轮次不在本版目录中，请保留原文件并核对资料版本。');
    return {degree:value.degree,cycle,universityIds:ids(value.universityIds,catalog.universities.map(u=>u.id),'学校清单'),
      interests:ids(value.interests,INTERESTS,'研究方向'),researchQuery:text(value.researchQuery??'',160,'研究关键词'),education:value.education,english:value.english,gpaNote:text(value.gpaNote,2000,'学业备注')};
  }
  function portable(catalog, state) {
    const catalogHistory=validateCatalogHistory(state.catalogHistory);
    if(state.catalogCheckedDate!==undefined&&(state.catalogSnapshotId!==catalog.snapshotId||state.catalogCheckedDate!==catalog.checkedDate)){
      const previous={snapshotId:state.catalogSnapshotId??null,checkedDate:state.catalogCheckedDate};
      if(!catalogHistory.some(entry=>entry.snapshotId===previous.snapshotId&&entry.checkedDate===previous.checkedDate))catalogHistory.push(previous);
    }
    const value={kind:'research-admissions-navigator-local',schemaVersion:3,catalogCheckedDate:catalog.checkedDate,catalogSnapshotId:catalog.snapshotId||null,
      catalogHistory,profile:state.profile,shortlist:state.shortlist,tasks:state.tasks,sourceIds:state.sourceIds || []};
    return validatePortable(value,catalog);
  }
  function validateCatalogHistory(value) {
    if(value===undefined)return [];
    if(!Array.isArray(value)||value.length>256)throw new Error('资料版本历史格式不正确或超过256项，请保留原备份，不要删除历史后硬载入。');
    const seen=new Set();
    return value.map(entry=>{
      if(!entry||!(entry.snapshotId===null||(typeof entry.snapshotId==='string'&&/^sha256:[0-9a-f]{64}$/.test(entry.snapshotId))))throw new Error('资料版本历史的摘要不正确，请保留原备份。');
      const checkedDate=text(entry.checkedDate,30,'资料版本历史日期'),key=JSON.stringify([entry.snapshotId,checkedDate]);
      if(seen.has(key))throw new Error('资料版本历史有重复项，请保留原备份并核对来源。');
      seen.add(key);return {snapshotId:entry.snapshotId,checkedDate};
    });
  }
  function researchOptions(catalog) {
    const options=INTERESTS.map(label=>({kind:'category',label,value:label})),terms=new Set();
    catalog.faculty.forEach(f=>(f.researchKeywords?.length?f.researchKeywords:f.topics||[]).forEach(value=>{if(typeof value==='string'&&value.trim())terms.add(value.trim());}));
    [...terms].sort((a,b)=>a.localeCompare(b,'zh-Hans')).forEach(value=>options.push({kind:'keyword',label:value,value}));
    (catalog.academicCoverage||[]).forEach(row=>{const university=catalog.universities.find(u=>u.id===row.universityId);row.units.filter(u=>!['graduate_school','undergraduate_college'].includes(u.kind)).forEach(unit=>{
      const prefix=(university.short||university.name)+' · '+academicLabel(unit.name);options.push({kind:'unit',label:prefix,universityId:row.universityId,unitId:unit.id});
      (unit.children||[]).forEach(child=>options.push({kind:'unit',label:prefix+' · '+academicLabel(child.name),universityId:row.universityId,unitId:unit.id}));
      (unit.relatedNavigationGroups||[]).filter(g=>!['teaching_support','administrative_support','college_components'].includes(g.kind)).forEach(group=>{
        const scopeLabel=group.kind==='research_fields'?'研究领域（非学系）':group.kind==='research_degree_navigation'?'研究学位入口（非学系名单）':group.kind==='research_organizations'?'研究机构（非学系）':group.kind==='academic_subjects'?'学科条目（非学系名单）':'下层或关联学术单位';
        group.entries.filter(e=>!['teaching_support','administrative_support'].includes(e.kind)).forEach(entry=>options.push({kind:'unit',label:prefix+' · '+(group.parentUnitName?academicLabel(group.parentUnitName)+' · ':'')+academicLabel(entry.name),universityId:row.universityId,unitId:unit.id,groupTitle:group.title,scopeLabel}));
      });
    });});
    return options;
  }
  function searchResearchOptions(options,query,kind) {
    const aliases=[['法学','law'],['医学','medicine'],['护理','nursing'],['公共卫生','public health'],['建筑','architecture'],['土木','civil'],['机械','mechanical'],['电子','electronic','electrical'],['计算机','computing','computer'],['商科','business'],['会计','accounting'],['管理','management'],['经济','economics'],['社会','social'],['人文','humanities'],['教育','education'],['数学','mathematics'],['统计','statistics'],['物理','physics'],['化学','chemistry'],['生命','life','biological'],['生物','bio'],['环境','environment'],['材料','materials'],['能源','energy'],['设计','design'],['音乐','music'],['艺术','arts'],['旅游','tourism','hotel'],['药学','pharmacy'],['兽医','veterinary'],['牙科','dentistry'],['心理','psychology'],['语言','language'],['传媒','media','journalism'],['地球','earth','planetary'],['城市','urban'],['房地产','real estate'],['哲学','philosophy'],['历史','history'],['金融','finance'],['地理','geography'],['控制','control'],['自动化','automation']];
    const q=(query||'').normalize('NFKC').trim().toLocaleLowerCase('en-US'),needles=new Set([q]);
    aliases.forEach(group=>{if(group.some(word=>word===q))group.forEach(word=>needles.add(word));});
    return options.filter(item=>(!kind||item.kind===kind)&&(!q||[...needles].some(word=>item.label.normalize('NFKC').toLocaleLowerCase('en-US').includes(word))));
  }
  function sharedSchoolRead(catalog, universityId, child) {
    if(!child||child.kind!=='affiliated_school'||child.relationship!=='affiliated_school'||child.entryBodyStatus!=='not_read'||!officialUrl(child.url))return null;
    const school=(catalog.academicCoverage||[]).find(row=>row.universityId===universityId);
    if(!school)return null;
    for(const unit of school.units){
      for(const donor of unit.children||[]){
        if(donor===child||donor.kind!=='school'||donor.url!==child.url||donor.retrievedUrl!==child.url||donor.entryBodyStatus!=='body_read'||(donor.observedName||donor.name)!==child.name||!/^[a-f0-9]{64}$/.test(donor.bodySha256||''))continue;
        const sources=(donor.sourceIds||[]).map(id=>catalog.sources.find(s=>s.id===id)).filter(s=>s&&s.url===child.url&&s.bodySha256===donor.bodySha256&&['official_verified_page_scoped','official_scoped_body_read'].includes(s.evidenceLevel)&&s.responseKind!=='access_challenge'&&/^\d{4}-\d\d-\d\d$/.test(s.checkedAt));
        if(sources.length)return {sourceIds:sources.map(s=>s.id),checkedDates:[...new Set(sources.map(s=>s.checkedAt))],bodySha256:donor.bodySha256};
      }
    }
    return null;
  }
  function validatePortable(value, catalog) {
    if (!value || value.kind !== 'research-admissions-navigator-local' || ![1,2,3].includes(value.schemaVersion)) throw new Error('这不是当前版本可载入的完整研向备份。若来自更新版本，请用对应版本打开，并保留原文件。');
    if(value.schemaVersion>=2&&!Array.isArray(value.catalogHistory))throw new Error('这份备份缺少资料版本历史，请保留完整原文件。');
    if(value.schemaVersion===3&&typeof value.profile?.researchQuery!=='string')throw new Error('这份备份缺少研究关键词字段，请保留完整原文件。');
    const profile=normalizeProfile(value.profile,catalog), shortlist=ids(value.shortlist,catalog.faculty.map(f=>f.id),'导师清单');
    const sourceIds=ids(value.sourceIds,catalog.sources.map(s=>s.id),'来源清单');
    if (!Array.isArray(value.tasks) || value.tasks.length>200) throw new Error('待办数量或格式不正确。');
    const knownTaskIds=new Set();
    const tasks=value.tasks.map(t=>{
      if (!t || typeof t.id!=='string' || !/^task-[a-z0-9-]{1,80}$/.test(t.id) || knownTaskIds.has(t.id) || typeof t.done!=='boolean') throw new Error('待办编号或完成状态不正确。');
      knownTaskIds.add(t.id);
      if (t.programId!==null && !catalog.programs.some(p=>p.id===t.programId)) throw new Error('待办中的项目编号已不匹配。');
      if (t.facultyId!==null && !catalog.faculty.some(f=>f.id===t.facultyId)) throw new Error('待办中的导师编号已不匹配。');
      return {id:t.id,text:text(t.text,500,'待办'),done:t.done,programId:t.programId,facultyId:t.facultyId};
    });
    const snapshot=value.catalogSnapshotId===undefined?null:value.catalogSnapshotId;
    if(snapshot!==null&&(typeof snapshot!=='string'||!/^sha256:[0-9a-f]{64}$/.test(snapshot)))throw new Error('资料版本编号不正确，请保留原文件。');
    return {kind:value.kind,schemaVersion:value.schemaVersion,catalogCheckedDate:text(value.catalogCheckedDate,30,'资料日期'),catalogSnapshotId:snapshot,catalogHistory:validateCatalogHistory(value.catalogHistory),profile,shortlist,tasks,sourceIds};
  }
  function parsePortable(raw, catalog) {
    if (typeof raw!=='string' || new TextEncoder().encode(raw).length>1024*1024) throw new Error('备份超过 1 MiB，请保留原文件，不要删改后硬载入。');
    let value;try { value=JSON.parse(raw); } catch (_) { throw new Error('JSON 文件不完整或格式有误，请换回完整备份。'); }
    return validatePortable(value,catalog);
  }
  return {academicChineseName,academicLabel,INTERESTS,officialUrl,sourceUrl,facultyLinks,facultyLinkSections,observedProfileUrl,directoryResearchSource,defaultProfile,cyclesFor,cycleLabel,matchedTopics,matchedResearchTerms,applicationDegrees,programsFor,facultyFor,directoriesFor,reviewedForDirectory,requirementsFor,financesFor,financeRates,financeRateText,preparationNote,deadlineState,isHongKongUniversity,fundingFor,deadlinesFor,availabilityText,portable,researchOptions,searchResearchOptions,sharedSchoolRead,validatePortable,parsePortable};
}));
