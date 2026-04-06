"""
setup.py — Appwrite Security Analysis Python Paketi
Tersine Mühendislik Dersi — Vize Projesi

Kurulum:
    pip install -e .          # Geliştirme modu (editable)
    pip install .             # Normal kurulum
"""

from setuptools import find_packages, setup

with open("README.md", encoding="utf-8") as f:
    long_description = f.read()

with open("poc/requirements.txt", encoding="utf-8") as f:
    requirements = [
        line.strip()
        for line in f
        if line.strip() and not line.startswith("#")
    ]

setup(
    name="appwrite-security-analysis",
    version="1.0.0",
    author="alituranakt",
    description="Appwrite IDOR/BOLA Security Analysis — Tersine Mühendislik Vize Projesi",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/alituranakt/Appwrite-Security-Analysis-IDOR-BOLA",
    packages=find_packages(where="poc"),
    package_dir={"": "poc"},
    python_requires=">=3.8",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=7.0",
            "pytest-cov>=4.0",
            "flake8>=6.0",
            "bandit>=1.7",
        ]
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Education",
        "Topic :: Security",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    entry_points={
        "console_scripts": [
            "appwrite-idor=poc.idor_demo:main",
        ],
    },
)
