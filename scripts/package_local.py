"""Package committed local source and the offline page, without credentials or user notes."""
import argparse
import hashlib
import json
import re
import subprocess
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--out", type=Path, required=True)
args = parser.parse_args()
out = args.out.resolve()
out.mkdir(parents=True, exist_ok=False)


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


if git("status", "--porcelain", "--untracked-files=no").strip():
    raise ValueError("Commit tracked source changes before packaging")
source = git("rev-parse", "HEAD").decode().strip()
members = {}
for name in git("ls-files", "-z").decode().split("\0"):
    if not name:
        continue
    relative = PurePosixPath(name)
    if relative.is_absolute() or {".git", ".venv", "artifacts"}.intersection(relative.parts) or ".." in relative.parts:
        raise ValueError("Unexpected source path")
    data = git("show", "HEAD:" + name)
    members["source/" + name] = data
    if name.startswith("dist/"):
        members["app/" + name[len("dist/"):]] = data
catalog = json.loads(members["source/data/catalog.json"])
version = json.loads(members["source/STATUS.json"])["version"]
if not re.fullmatch(r"\d+\.\d+\.\d+(?:-local|a\d+)", version):
    raise ValueError("Use an explicit local prototype or alpha version")
members["START_HERE.md"] = """# 研向：本地试用

先完整解压文件夹，再双击 app/index.html。无需注册，也不需要安装 Python、Node 或第三方库。

先选学校、学位和入学轮次，再看项目要求或找研究交集。老师的方向相关，不等于当前有名额；没有列出的项目也不等于学校不招生。

在“我的清单”保存导师、待办和备份。下载按钮发起保存后，请自行核对文件是否实际保存。个人备注只在你选择保存时写入本机，不上传。

以前原型保存的格式1、2备份仍可载入。本版导出格式3，请用随附本版或更新版本接着整理，避免旧程序丢掉研究关键词或资料版本历史。历史里只有已提供的版本线索，不是官网全文；旧材料和旧费用仍需重新核对。文件或本机写入出错时，当前清单会保留，请不要删改原备份后硬载入。

有费用资料的项目，可展开“学费、申请费和资助分开看”。注意币种、每月/每年/每学年、适用轮次和资助条件；旧年度金额只作参考，不是个人已经获批的收入，也不代表完整生活预算。

“找相关老师”可以填具体研究词；找不到时用“看院系目录”继续查。已整理人数不是可申请人数上限，项目要求还没有覆盖每个院系。“分享经历”当前只导出匿名草稿，不会公开提交；这里不是完整导师库、实时招生系统或录取预测。

source/ 保存对应源码、原始整理记录、不可覆盖的数据快照和开发检查。备份标记资料版本；页面使用当前目录，旧政策应结合对应旧目录核对。

这是早期alpha。也可打开公开网页 https://c4llm3luc4s.github.io/research-admissions-navigator/ ，但网页可能更新，旧政策请保留本包资料。个人清单按浏览器来源分开，换网页或设备请带上完整备份。实际验收范围见source/STATUS.json；代码检查、模拟DOM回调、真实浏览器操作分别记录，不代替独立真人反馈。
""".encode()
info = {"version": version, "source_commit": source, "source_tree": git("rev-parse", "HEAD^{tree}").decode().strip(),
        "catalog_snapshot": catalog["snapshotId"], "publicly_deployed": True, "web_entry": "https://c4llm3luc4s.github.io/research-admissions-navigator/", "contains_personal_profile": False}
if not version.endswith('-local'):
    info.update(repository_url="https://github.com/C4LLM3LUC4S/research-admissions-navigator", release_tag="v" + version,
                artifact_scope="Experimental offline alpha; partial evidence-linked coverage, no hosted feedback service")
members["BUILD_INFO.json"] = (json.dumps(info, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
manifest = {"source_commit": source, "files": {name: {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()} for name, data in members.items()}}
members["MANIFEST.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
archive = out / (("Yanxiang-local-prototype-" + version.removesuffix("-local") + ".zip") if version.endswith('-local') else ("Yanxiang-" + version + "-offline.zip"))
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zipped:
    for name, data in sorted(members.items()):
        zipped.writestr(name, data)
with zipfile.ZipFile(archive) as zipped:
    assert zipped.testzip() is None and set(zipped.namelist()) == set(members)
    for name, data in members.items():
        assert zipped.read(name) == data
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
checksums = [digest + "  " + archive.name]
if not version.endswith('-local'):
    release_info = out / "RELEASE_INFO.json"
    release_info.write_text(json.dumps({**info, "archive": archive.name, "bytes": archive.stat().st_size, "sha256": digest}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    checksums.append(hashlib.sha256(release_info.read_bytes()).hexdigest() + "  RELEASE_INFO.json")
(out / "SHA256SUMS").write_text("\n".join(checksums) + "\n", encoding="ascii")
(out / "summary.json").write_text(json.dumps({"status": "passed_local_package", **info, "members": len(members), "zip_sha256": digest,
    "scope": "Local committed package CRC, member bytes and hashes; no new UI/download/independent-user or public-release claim"}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"status": "passed", "archive": str(archive), "members": len(members)}))
