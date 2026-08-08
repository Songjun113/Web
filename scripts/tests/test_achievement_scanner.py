import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

MODULE_PATH = Path(__file__).parents[1] / "achievement_scanner.py"
SPEC = importlib.util.spec_from_file_location("achievement_scanner", MODULE_PATH)
scanner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(scanner)


class AchievementScannerTests(unittest.TestCase):
    def test_added_modified_removed_and_sensitive_redaction(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source, state = root / "source", root / "state"
            source.mkdir()
            note = source / "2026_EEG论文.md"
            note.write_text("脑电运动解码 paper 联系 13812345678 test@example.com", encoding="utf-8")
            first = scanner.scan(source, state)
            self.assertEqual(first["candidateCount"], 1)
            self.assertEqual(first["candidates"][0]["suggestedType"], "paper")
            self.assertEqual(first["candidates"][0]["suggestedResearchTrack"], "eeg-decoding")
            self.assertNotIn("13812345678", json.dumps(first, ensure_ascii=False))

            self.assertEqual(scanner.scan(source, state)["candidateCount"], 0)
            note.write_text("脑电语言解码 updated", encoding="utf-8")
            self.assertEqual(scanner.scan(source, state)["candidates"][0]["change"], "modified")
            note.unlink()
            self.assertEqual(scanner.scan(source, state)["candidates"][0]["change"], "removed")

    def test_rename_is_not_a_new_achievement(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source, state = root / "source", root / "state"
            source.mkdir()
            original = source / "project.md"
            original.write_text("混合现实项目", encoding="utf-8")
            scanner.scan(source, state)
            original.rename(source / "renamed-project.md")
            result = scanner.scan(source, state)
            self.assertEqual(result["candidates"][0]["change"], "renamed")

    def test_docx_and_xlsx_are_extracted_without_office(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            source, state = root / "source", root / "state"
            source.mkdir()
            with zipfile.ZipFile(source / "卒中康复项目.docx", "w") as archive:
                archive.writestr("word/document.xml", '<w:document xmlns:w="x"><w:t>卒中后运动康复 project 2026</w:t></w:document>')
            with zipfile.ZipFile(source / "MR成果.xlsx", "w") as archive:
                archive.writestr("xl/sharedStrings.xml", '<sst xmlns="x"><si><t>混合现实场景生成 patent 2025</t></si></sst>')
                archive.writestr("xl/worksheets/sheet1.xml", '<worksheet xmlns="x"><sheetData/></worksheet>')
            result = scanner.scan(source, state)
            self.assertEqual(result["candidateCount"], 2)
            tracks = {item["suggestedResearchTrack"] for item in result["candidates"]}
            self.assertIn("mixed-reality-ai", tracks)
            self.assertIn("stroke-rehabilitation", tracks)


if __name__ == "__main__":
    unittest.main()
