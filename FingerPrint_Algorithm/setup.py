from setuptools import setup
from Cython.Build import cythonize

setup(
    ext_modules=cythonize("glossary_compression.pyx"),
)
