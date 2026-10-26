from pathlib import Path
import unittest


ASSETS = Path(__file__).resolve().parents[1] / "docs" / "assets"


def jpeg_size(raw: bytes):
    if len(raw) < 4 or raw[:2] != b"\xff\xd8" or raw[-2:] != b"\xff\xd9":
        raise ValueError("not a complete JPEG")
    i = 2
    while i + 4 <= len(raw):
        if raw[i] != 0xFF:
            i += 1
            continue
        while i < len(raw) and raw[i] == 0xFF:
            i += 1
        if i >= len(raw):
            break
        marker = raw[i]
        i += 1
        if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
            continue
        if i + 2 > len(raw):
            break
        length = int.from_bytes(raw[i:i+2], "big")
        if length < 2 or i + length > len(raw):
            raise ValueError("truncated JPEG segment")
        if marker in {
            0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
            0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
        }:
            if length < 7:
                raise ValueError("invalid JPEG frame")
            height = int.from_bytes(raw[i+3:i+5], "big")
            width = int.from_bytes(raw[i+5:i+7], "big")
            return width, height
        i += length
    raise ValueError("JPEG has no frame header")


class ReadmeAssetTests(unittest.TestCase):
    def test_promotional_jpegs_are_complete_images(self):
        expected = {
            "discord-wiki-community-notebook-showcase.jpg": (100, 100),
            "discord-wiki-community-knowledge-journey.jpg": (100, 100),
        }
        for name, minimum in expected.items():
            with self.subTest(name=name):
                raw = (ASSETS / name).read_bytes()
                self.assertGreater(len(raw), 5_000)
                width, height = jpeg_size(raw)
                self.assertGreaterEqual(width, minimum[0])
                self.assertGreaterEqual(height, minimum[1])


if __name__ == "__main__":
    unittest.main()
