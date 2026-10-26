# 帮这份目录变得更可靠

你可以补一个没收录的院系或老师，也可以指出一句容易看错的说明。比起单纯增加链接，更有帮助的是说清楚“哪所学校、哪个院系、哪种学位、哪一轮，原页具体写了什么”。

补资料时，请给官方原页和实际读取日期。教师研究、公开招生说明和当前余位分别记录；兼职、关联、荣休或访问身份保留原意，不能统一当作正职导师。网页只有搜索摘要或脚本壳时，写成待核，不伪装成已读正文。不要上传个人申请编号、成绩单、私人邮件或聊天截图。

本地改完后运行：

```text
python scripts/build_catalog.py
node --test tests/logic.test.cjs tests/app-flow.test.cjs tests/finance.test.cjs tests/faculty-discovery.test.cjs
python -m unittest discover -s tests -p test_catalog_validation.py
```

再照着页面完成一次与你的改动有关的任务，例如查研究词、回到原始依据、保存清单和恢复。说明你实际做了哪些步骤、哪些还没做；不要把自动检查写成真人反馈。

代码与原创整理文字采用MIT许可，见LICENSE。链接指向的大学网页、商标及第三方原文仍属于各自权利人；本项目不重新许可这些原文，也不保存整站镜像。保留事实出处、做简短转述，避免直接搬运完整简介和论文内容。
