# 研向（工作名）

想申请研究型硕士或博士，却不知道从哪里查起？这个工具先帮你看清项目要求，找到值得进一步了解的老师，再把申请准备整理成能继续推进的清单。

首批学校：港大、港中文、港科技、港理工、港城市、港中深、港科广。当前已整理980份教师研究资料、41个官方院系目录入口（含官网公布的未来任职），涵盖计算机、AI、电子工程、控制和数据科学，并开始补数学、统计、金融、设计、环境及人文社科等方向。先看[覆盖说明](COVERAGE.md)了解哪些已读、哪些还没核全，再按[学院和学系清单](ACADEMIC_COVERAGE.md)继续找人。这是持续完善的早期alpha，个人资料留在本机；已整理人数不是全部导师、可以申请的人数上限或当前名额。

## 打开方式

**网页入口：<https://c4llm3luc4s.github.io/research-admissions-navigator/>**。网页部署状态见仓库的Pages环境；若暂时打不开，可用下面的离线方式。网页与离线版使用同一套页面和资料，没有注册、录取预测或个人资料上传接口。本机保存与备份仍由你选择；换设备请带上完整备份。

下载源码后直接打开 `dist/index.html`，不需要注册、账户、API 密钥或服务器。[GitHub Releases](https://github.com/C4LLM3LUC4S/research-admissions-navigator/releases)中有离线包时，选择`Yanxiang-版本-offline.zip`，先完整解压，再打开 `app/index.html`；只想使用页面，不必运行下面的开发命令。数据入口为 `data/catalog.json`，页面使用由脚本生成的 `dist/catalog.js`。

```powershell
python scripts/build_catalog.py
node --test tests/*.test.cjs
python -m unittest discover -s tests -p test_catalog_validation.py
```

页面和数据状态以 `STATUS.json` 为准。功能与范围见 [产品说明](PRODUCT_BRIEF.md)。

有具体研究问题时，可以直接输入关键词，再点“查看筛选结果”。宽泛方向放在可展开的筛选里，已选数量会一直显示；想放宽范围时可以清除筛选。保存或载入含关键词的清单后，再次打开会先显示相关老师，不会把项目列表当作关键词匹配结果。

`docs/` 是发布到GitHub Pages的自动生成副本，请改 `dist/` 后运行目录构建命令；检查流程会拒绝不一致的网页副本。

## 从哪里开始准备

1. 选学校、学位和入学轮次。春季与秋季、香港与深圳/广州分别核对。
2. 打开项目卡片中的“已核到的要求与下一步”，看学历、英语、材料或资助说明；每一项都有官方出处。这里仍是部分整理，不能代替官网完整材料清单。
3. 把需要做的那一步加入待办。清单保留项目、学位与轮次；例如港中文CSE的两个申请系统、博士三位推荐人，不会与MPhil两位推荐人混在一起。
4. 到“找相关老师”填写具体研究词，比如“网络化控制”“自然语言处理”。多个词用逗号分开，命中任一词即可；只查官网已核到的研究词，支持部分中英文对应词。列表顺序不是推荐排名。没找到时，可到“看院系目录”继续查；目录只按学校筛选，不会因为关键词未命中而把院系藏起来。
5. 教师卡片可展开“继续看个人主页与研究档案”。链接来自院系页面，已读正文和仍待整理分开标明；个人网站不是学校招生政策。对感兴趣的老师，打开研究依据、收藏或加入跟进待办。先读主页与近期工作，核对对应的申请项目、学位和轮次，再决定是否联系。方向相关只意味着值得继续了解，当前名额另外确认。
6. 在“我的清单”导出完整备份，并保留这一版目录。换设备或隔天使用时载入；原文件不会修改，研究关键词和旧资料版本线索保存在历史中，页面使用当前目录。

“看院系目录”中，已做完整枚举的分类会列出每个人的进度。例如港科大CSE Regular本轮列出53个不同主页，读到38个，15个网络超时。它只是这组目录的整理进度，不是导师名额或全校覆盖率。

“目前的学习阶段”和“英语准备情况”只提供准备提醒，不判定资格、换算GPA或给录取概率。不同项目可能接受不同考试形式：不要把一家学校的规则复制到另一家。

有费用资料的项目可展开“学费、申请费和资助分开看”。金额保留币种、每月/每年/每次申请和适用轮次。旧年度或未注明轮次的金额只作参考；“纳入资助考虑”不是已经获得资助。这里不把学费减去津贴来算个人净费用，也不代替完整生活预算。

港中深CIE目前要求硕博均提供两位非意向导师的推荐人；香港本部研究院的博士材料另有要求。请始终按具体项目核对，别只看大学名字。

## 用旧备份接着准备

本版仍能载入原格式1、2的备份；新导出使用格式3，把具体研究词也保存下来，旧备份没有这个字段时留空。请用本版或更新版本继续整理，保留原文件；旧程序会拒绝格式3，避免默默丢掉新信息。

页面使用当前目录，但会把旧备份带来的核查日期和资料摘要保存在历史里。“我的清单”可展开查看，重启后再导出也会保留。这里存的是版本线索，不是官网全文，也不能证明每条旧笔记当时对应哪条政策；旧材料和费用仍需重新核对。只保留你实际提供的版本，不自动合并另一份清单的笔记、待办或历史。

导入前会验证版本历史和容量。文件损坏、历史超限或本机写入失败时，不替换当前清单；如果新增待办暂时无法写入浏览器，它仍可留在当前页面并导出备份，不能把写入失败当已保存。

## 怎么理解结果

- “研究方向有交集”表示值得继续读主页，不表示已经满足申请条件、正在招生或一定能录取。
- “尚未确认”不是“没有名额”。项目是否需要提前联系导师，不能只看院校名称。
- 日期必须和学年、项目、申请类别一起看。官网规则、用户经历和产品推断分开。
- 个人资料只在本机按你的选择保存。经历表单目前仅生成匿名草稿，不会自动对外提交。

本项目独立于 RankProbe、SparsiLoop 和课程作业。公开源码不包含个人备份、成绩单或申请经历；页面不上传个人资料。贡献方法与第三方原文边界见[CONTRIBUTING.md](CONTRIBUTING.md)。真实浏览器开发者走查与自动检查分别记录，均不冒充独立真人使用。

## English

An early alpha for research-degree applicants to explore official programme rules, faculty research and practical next steps, online or from an offline download. Current partial coverage includes 980 faculty research records, 41 official directory entries and 31 programme/application routes across seven institutions. The academic map lists schools and departments still to review; these counts do not describe all potential supervisors. Some MPhil degrees belong to integrated MPhil-PhD schemes and are not standalone application routes; each card explains its own conditions. Concrete research keywords, follow-up tasks and portable backups help applicants continue investigating. Programme, degree, campus and intake remain separate. Research overlap does not establish recruitment availability or admission probability. Personal notes stay in the browser; there is no public experience-submission backend.


先在“看院系目录”查看[七校学院与师资整理进度](ACADEMIC_COVERAGE.md)，再进入具体学院和下属学系。学校架构、待核个人页与已整理研究方向的人数分别显示，不把当前收录量当作全部老师。

新增的生命科学与生物工程、化学工程分类只帮助找研究线索，不是对申请资格的自动判断。备份使用这些新分类时，请用本版或更新版本继续整理；旧版无法识别的新分类不应手工删掉后强行载入。
