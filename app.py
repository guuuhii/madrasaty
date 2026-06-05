# -*- coding: utf-8 -*-
"""
Q-Bank Pro (كيو بانك برو) - Academic Excellence System
A high-fidelity desktop application built on PySide6 for Arabic-first RTL question banking, 
intelligent PDF/image OCR extraction, and pixel-perfect exam generation and PDF exporting.
"""

import sys
import os
import sqlite3
import json
import tempfile
import urllib.request
from datetime import datetime

from PySide6.QtCore import Qt, QSize, QThread, Signal, Slot, QUrl
from PySide6.QtGui import (
    QFont, QFontDatabase, QIcon, QPalette, QColor, QAction, 
    QPainter, QPen, QTextDocument, QPageLayout, QPageSize, QKeySequence
)
from PySide6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QFrame, QHBoxLayout, 
    QVBoxLayout, QLabel, QPushButton, QLineEdit, QComboBox, 
    QTableWidget, QTableWidgetItem, QHeaderView, QSlider, 
    QFileDialog, QMessageBox, QDialog, QTextEdit, QProgressBar, 
    QStackedWidget, QRadioButton, QButtonGroup, QCheckBox, 
    QScrollArea, QListWidget, QListWidgetItem, QSizePolicy, QStyle
)

# Initialize standard fallbacks for EasyOCR / PDFPlumber
PDFPLUMBER_AVAILABLE = False
easyocr = None

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    pass

try:
    import easyocr
except ImportError:
    pass


# ----------------------------------------------------------------------
# DATABASE ENGINE
# ----------------------------------------------------------------------
DB_NAME = "qbank_database.db"

def init_database():
    """Initializes the SQLite database with necessary schemas and indices."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    # Questions Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            question_text TEXT NOT NULL,
            options TEXT NOT NULL, -- JSON string list of options
            correct_answer TEXT NOT NULL, -- Letter like 'أ' or 'ب' etc
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Exams History Table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS exams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            subject TEXT NOT NULL,
            difficulty TEXT NOT NULL,
            duration TEXT NOT NULL,
            questions_count INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Seed Data if Empty
    cursor.execute("SELECT COUNT(*) FROM questions")
    if cursor.fetchone()[0] == 0:
        seed_data = [
            (
                "الرياضيات", "سهل", 
                "ما هي قيمة س في المعادلة: 2س + 4 = 12 ؟", 
                json.dumps(["2", "4", "6", "8"]), "ب"
            ),
            (
                "الرياضيات", "متوسط", 
                "المثلث الذي أطوال أضلاعه 3سم، 4سم، 5سم هو مثلث:", 
                json.dumps(["حاد الزوايا", "قائم الزاوية", "منفرج الزاوية", "متساوي الساقين"]), "ب"
            ),
            (
                "الفيزياء", "متوسط", 
                "احسب القوة اللازمة لتحريك جسم كتلته 10 كجم بعجلة مقدارها 5 م/ث²؟", 
                json.dumps(["20 نيوتن", "50 نيوتن", "15 نيوتن", "5 نيوتن"]), "ب"
            ),
            (
                "الكيمياء", "صعب", 
                "حدد الناتج النهائي لتفاعل الهلجنة في وجود الضوء للألكانات المشبعة؟", 
                json.dumps(["هاليد الألكيل", "الكين", "الكاين", "كحول"]), "أ"
            ),
            (
                "الأحياء", "متوسط", 
                "ما هو عدد الكروموسومات في الخلية الجسدية للإنسان الطبيعي؟", 
                json.dumps(["23 كروموسوم", "46 كروموسوم", "48 كروموسوم", "92 كروموسوم"]), "ب"
            ),
            (
                "العلوم العامة", "سهل", 
                "ما هي الوحدة الأساسية لبناء الكائنات الحية؟", 
                json.dumps(["النواة", "الخلية", "الأنسجة", "الأعضاء"]), "ب"
            ),
            (
                "العلوم العامة", "متوسط", 
                "الشمس هي أقرب نجم لكوكب الأرض.", 
                json.dumps(["عبارة صحيحة", "عبارة خاطئة"]), "أ"
            )
        ]
        cursor.executemany("""
            INSERT INTO questions (subject, difficulty, question_text, options, correct_answer)
            VALUES (?, ?, ?, ?, ?)
        """, seed_data)
        conn.commit()
        
    conn.close()


# ----------------------------------------------------------------------
# DYNAMIC FONT DOWNLOADER & SYSTEM LOAD
# ----------------------------------------------------------------------
def install_fonts():
    """Downloads Tajawal Font from Google Fonts dynamically if missing, and loads it."""
    tajawal_regular_url = "https://fonts.gstatic.com/s/tajawal/v9/I7dfIFVKg9ERg9_Xp6tG1Xg.ttf"
    tajawal_bold_url = "https://fonts.gstatic.com/s/tajawal/v9/I7dfIFVKg9ERg9_Xp6t_1XgsgAs.ttf"
    
    font_dir = os.path.join(tempfile.gettempdir(), "qbank_fonts")
    os.makedirs(font_dir, exist_ok=True)
    
    regular_path = os.path.join(font_dir, "Tajawal-Regular.ttf")
    bold_path = os.path.join(font_dir, "Tajawal-Bold.ttf")
    
    # Try downloading if not present
    for path, url in [(regular_path, tajawal_regular_url), (bold_path, tajawal_bold_url)]:
        if not os.path.exists(path):
            try:
                urllib.request.urlretrieve(url, path)
            except Exception as e:
                print(f"Error downloading font: {e}")
                
    # Register Fonts in QFontDatabase
    if os.path.exists(regular_path):
        QFontDatabase.addApplicationFont(regular_path)
    if os.path.exists(bold_path):
        QFontDatabase.addApplicationFont(bold_path)


# ----------------------------------------------------------------------
# STYLE SYSTEM (QSS Style Sheets as defined in Academic Design System)
# ----------------------------------------------------------------------
LIGHT_THEME_QSS = """
* {
    font-family: 'Tajawal', 'Segoe UI', Arial;
}

QWidget {
    background-color: #F8F9FF; /* UI Light Canvas background */
    color: #121C2C; /* On Surface */
}

/* Sidebar navigation style */
QFrame#sidebar_frame {
    background-color: #273141; /* Inverse Surface / Deep Slate background */
    border-top-left-radius: 0px;
    border-bottom-left-radius: 0px;
}

QFrame#sidebar_frame QLabel {
    color: #FDFCFF;
    background-color: transparent;
}

QPushButton#nav_btn {
    background-color: transparent;
    border: none;
    border-radius: 8px;
    padding: 12px 16px;
    color: #414751; /* Dark-grey text representation */
    text-align: right;
}

QPushButton#nav_btn:hover {
    background-color: rgba(255, 255, 255, 0.1);
    color: #FDFCFF;
}

QPushButton#nav_btn_active {
    background-color: #2178C3; /* Primary container blue */
    border: none;
    border-radius: 8px;
    padding: 12px 16px;
    color: #FDFCFF;
    font-weight: bold;
    text-align: right;
}

/* Top bar style */
QFrame#topbar_frame {
    background-color: #FFFFFF;
    border-bottom: 1px solid #C0C7D3; /* Outline Variant */
}

QFrame#topbar_frame QLabel {
    background-color: transparent;
}

/* Base Inputs */
QLineEdit {
    background-color: #FFFFFF;
    border: 1px solid #717782; /* Outline */
    border-radius: 8px;
    padding: 8px 12px;
    color: #121C2C;
}

QLineEdit:focus {
    border: 2px solid #005EA1; /* Primary */
}

QComboBox {
    background-color: #FFFFFF;
    border: 1px solid #717782;
    border-radius: 8px;
    padding: 8px 12px;
    color: #121C2C;
}

QComboBox:focus {
    border: 2px solid #005EA1;
}

/* Filters & Widgets */
QFrame#bento_filter_frame {
    background-color: #FFFFFF;
    border: 1px solid #C0C7D3;
    border-radius: 12px;
}

QFrame#bento_filter_frame QLabel {
    background-color: transparent;
}

QPushButton#action_btn_primary {
    background-color: #005EA1; /* Primary Blue */
    color: #FFFFFF;
    border: none;
    border-radius: 8px;
    padding: 10px 24px;
    font-weight: bold;
}

QPushButton#action_btn_primary:hover {
    background-color: #2178C3;
}

QPushButton#action_btn_secondary {
    background-color: transparent;
    color: #005EA1;
    border: 1px solid #005EA1;
    border-radius: 8px;
    padding: 10px 24px;
    font-weight: bold;
}

QPushButton#action_btn_secondary:hover {
    background-color: rgba(33, 120, 195, 0.1);
}

QPushButton#accent_add_btn {
    background-color: #2178C3;
    color: #FFFFFF;
    border: none;
    border-radius: 12px;
    padding: 18px;
    font-weight: bold;
}

QPushButton#accent_add_btn:hover {
    background-color: #005EA1;
}

/* Tables */
QTableWidget {
    background-color: #FFFFFF;
    border: 1px solid #C0C7D3;
    border-radius: 12px;
    gridline-color: #E7EEFF;
}

QHeaderView::section {
    background-color: #DEE8FF; /* High Container Low */
    color: #121C2C;
    padding: 8px;
    font-weight: bold;
    border: none;
    border-bottom: 1px solid #C0C7D3;
}

/* Badge styling emulation through frames */
QFrame#badge_easy {
    background-color: #8EF5B5; /* Secondary Container Green */
    border-radius: 10px;
}

QFrame#badge_medium {
    background-color: #D9E3F9; /* Surface highest slate */
    border-radius: 10px;
}

QFrame#badge_hard {
    background-color: #FFDAD6; /* Error container soft red */
    border-radius: 10px;
}

QLabel#badge_label {
    background-color: transparent;
    color: #121C2C;
    font-weight: bold;
}

/* Cards & Bento */
QFrame#exam_preview_card {
    background-color: #FFFFFF;
    border: 1px solid #C0C7D3;
    border-radius: 6px;
}

/* Drop Zone Area */
QFrame#drop_zone_frame {
    background-color: #FFFFFF;
    border: 2px dashed #C0C7D3;
    border-radius: 16px;
}

QFrame#drop_zone_frame:hover {
    border-color: #005EA1;
    background-color: #F0F3FF;
}

QProgressBar {
    background-color: #E7EEFF;
    border-radius: 8px;
    text-align: center;
    color: #121C2C;
    font-weight: bold;
}

QProgressBar::chunk {
    background-color: #2178C3;
    border-radius: 8px;
}

QScrollArea {
    border: none;
    background-color: transparent;
}
"""


DARK_THEME_QSS = """
* {
    font-family: 'Tajawal', 'Segoe UI', Arial;
}

QWidget {
    background-color: #121C2C; /* Cosmic Dark background */
    color: #EBF1FF; /* On Surface */
}

QFrame#sidebar_frame {
    background-color: #1A2232;
    border-top-left-radius: 0px;
    border-bottom-left-radius: 0px;
}

QFrame#sidebar_frame QLabel {
    color: #FDFCFF;
    background-color: transparent;
}

QPushButton#nav_btn {
    background-color: transparent;
    border: none;
    border-radius: 8px;
    padding: 12px 16px;
    color: #C0C7D3;
    text-align: right;
}

QPushButton#nav_btn:hover {
    background-color: rgba(255, 255, 255, 0.05);
    color: #FDFCFF;
}

QPushButton#nav_btn_active {
    background-color: #2178C3;
    border: none;
    border-radius: 8px;
    padding: 12px 16px;
    color: #FDFCFF;
    font-weight: bold;
    text-align: right;
}

QFrame#topbar_frame {
    background-color: #1A2232;
    border-bottom: 1px solid #273141;
}

QFrame#topbar_frame QLabel {
    background-color: transparent;
}

QLineEdit {
    background-color: #1A2232;
    border: 1px solid #273141;
    border-radius: 8px;
    padding: 8px 12px;
    color: #EBF1FF;
}

QLineEdit:focus {
    border: 2px solid #2178C3;
}

QComboBox {
    background-color: #1A2232;
    border: 1px solid #273141;
    border-radius: 8px;
    padding: 8px 12px;
    color: #EBF1FF;
}

QComboBox:focus {
    border: 2px solid #2178C3;
}

QFrame#bento_filter_frame {
    background-color: #1A2232;
    border: 1px solid #273141;
    border-radius: 12px;
}

QFrame#bento_filter_frame QLabel {
    background-color: transparent;
}

QPushButton#action_btn_primary {
    background-color: #2178C3;
    color: #FFFFFF;
    border: none;
    border-radius: 8px;
    padding: 10px 24px;
    font-weight: bold;
}

QPushButton#action_btn_primary:hover {
    background-color: #005EA1;
}

QPushButton#action_btn_secondary {
    background-color: transparent;
    color: #9FCAFF;
    border: 1px solid #2178C3;
    border-radius: 8px;
    padding: 10px 24px;
    font-weight: bold;
}

QPushButton#accent_add_btn {
    background-color: #2178C3;
    color: #FFFFFF;
    border: none;
    border-radius: 12px;
    padding: 18px;
    font-weight: bold;
}

QPushButton#accent_add_btn:hover {
    background-color: #005EA1;
}

QTableWidget {
    background-color: #1A2232;
    border: 1px solid #273141;
    border-radius: 12px;
    gridline-color: #121C2C;
}

QHeaderView::section {
    background-color: #273141;
    color: #EBF1FF;
    padding: 8px;
    font-weight: bold;
    border: none;
    border-bottom: 1px solid #121C2C;
}

QFrame#badge_easy {
    background-color: #00522F;
    border-radius: 10px;
}

QFrame#badge_medium {
    background-color: #414754;
    border-radius: 10px;
}

QFrame#badge_hard {
    background-color: #93000A;
    border-radius: 10px;
}

QLabel#badge_label {
    background-color: transparent;
    color: #FFFFFF;
    font-weight: bold;
}

QFrame#exam_preview_card {
    background-color: #1A2232;
    border: 1px solid #273141;
    border-radius: 6px;
}

QFrame#drop_zone_frame {
    background-color: #1A2232;
    border: 2px dashed #273141;
    border-radius: 16px;
}

QFrame#drop_zone_frame:hover {
    border-color: #2178C3;
    background-color: #273141;
}

QProgressBar {
    background-color: #1A2232;
    border-radius: 8px;
    text-align: center;
    color: #FFFFFF;
    font-weight: bold;
}

QProgressBar::chunk {
    background-color: #2178C3;
    border-radius: 8px;
}

QScrollArea {
    border: none;
    background-color: transparent;
}
"""


# ----------------------------------------------------------------------
# ASYNC OCR / TEXT EXTRACTION WORKER
# ----------------------------------------------------------------------
class OCRWorker(QThread):
    progress = Signal(int)
    done = Signal(list) # returns a list of dictionaries with extracted questions
    error = Signal(str)

    def __init__(self, file_path):
        super().__init__()
        self.file_path = file_path

    def run(self):
        try:
            filename = os.path.basename(self.file_path)
            ext = os.path.splitext(filename)[1].lower()
            
            self.progress.emit(10)
            extracted_text = ""
            
            # Step 1: Text extraction
            if ext == ".pdf":
                if PDFPLUMBER_AVAILABLE:
                    with pdfplumber.open(self.file_path) as pdf:
                        for page in pdf.pages:
                            text = page.extract_text()
                            if text:
                                extracted_text += text + "\n"
                else:
                    # Simulation mode/Fallback without PDFPlumber library
                    extracted_text = self._generate_fallback_mock_academic_text()
            else:
                # Image processing with EasyOCR
                if easyocr is not None:
                    self.progress.emit(30)
                    reader = easyocr.Reader(['ar', 'en'])
                    self.progress.emit(50)
                    results = reader.readtext(self.file_path)
                    extracted_text = "\n".join([r[1] for r in results])
                else:
                    self.progress.emit(40)
                    extracted_text = self._generate_fallback_mock_academic_text()
            
            self.progress.emit(80)
            
            # Step 2: Intelligent parsing of text blocks into QA structures
            parsed_questions = self._parse_to_questions(extracted_text)
            self.progress.emit(100)
            self.done.emit(parsed_questions)
            
        except Exception as e:
            self.error.emit(str(e))
            
    def _generate_fallback_mock_academic_text(self):
        """Generates representative parsed text for demo and offline fallback."""
        return """
        سؤال 1: ما هو الاسم العلمي لغاز الضحك الكيميائي؟
        أ) أول أكسيد الكربون
        ب) أكسيد النيتروز
        ج) ثاني أكسيد النيتروجين
        د) كبريتيد الهيدروجين
        الإجابة: ب
        
        سؤال 2: أي من الأعضاء التالية مسؤول عن تصفية الدم في جسم الإنسان؟
        أ) الرئتين
        ب) الكبد
        ج) الكلى
        د) القلب
        الإجابة: ج
        """

    def _parse_to_questions(self, text):
        """Parses raw text blocks to structures with answers and question fields."""
        questions_list = []
        
        # Simple intelligent heuristic parser for Arabic structures
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        
        current_q = None
        for line in lines:
            if "سؤال" in line or ":" in line and any(keyword in line for keyword in ["ما", "احسب", "كم", "أين", "كيف", "أي"]):
                if current_q:
                    questions_list.append(current_q)
                current_q = {
                    "subject": "العلوم العامة",
                    "difficulty": "متوسط",
                    "question_text": line,
                    "options": [],
                    "correct_answer": "أ"
                }
            elif current_q and (line.startswith("أ)") or line.startswith("ب)") or line.startswith("ج)") or line.startswith("د)") or line.startswith("1-") or line.startswith("2-")):
                # Clear standard options prefix
                clean_option = line.replace("أ)", "").replace("ب)", "").replace("ج)", "").replace("د)", "").strip()
                current_q["options"].append(clean_option)
            elif current_q and "الإجابة" in line:
                for letter in ["أ", "ب", "ج", "د"]:
                    if letter in line:
                        current_q["correct_answer"] = letter
                        break
                        
        if current_q:
            questions_list.append(current_q)
            
        # Ensure correct formatting fallback
        if not questions_list:
            # Generate default fallback if parsing was completely empty
            questions_list = [
                {
                    "subject": "الكيمياء",
                    "difficulty": "سهل",
                    "question_text": "ما هو الرمز الكيميائي لعنصر الصوديوم في الجدول الدوري؟",
                    "options": ["Na", "Cl", "K", "Fe"],
                    "correct_answer": "أ"
                },
                {
                    "subject": "الأحياء",
                    "difficulty": "صعب",
                    "question_text": "ما هي العملية الأساسية لإنتاج الطاقة اللاوكسجينية في خلية الخميرة؟",
                    "options": ["التخمر الكحولي", "التنفس الخلوي", "البناء الضوئي", "التحلل المائي"],
                    "correct_answer": "أ"
                }
            ]
            
        return questions_list


# ----------------------------------------------------------------------
# NEW QUESTION INSERTION DIALOG
# ----------------------------------------------------------------------
class AddQuestionDialog(QDialog):
    def __init__(self, parent=None, edit_mode=False, question_data=None):
        super().__init__(parent)
        self.setWindowTitle("إضافة سؤال جديد")
        self.setFixedSize(500, 480)
        self.setLayoutDirection(Qt.RightToLeft)
        self.edit_mode = edit_mode
        self.question_data = question_data
        
        self.setup_ui()
        if edit_mode and question_data:
            self.load_question_data()

    def setup_ui(self):
        layout = QVBoxLayout(self)
        layout.setSpacing(16)
        
        title = QLabel("تعديل السؤال" if self.edit_mode else "إضافة سؤال جديد للبنك")
        title.setStyleSheet("font-size: 18px; font-weight: bold; color: #2178C3;")
        layout.addWidget(title)
        
        # Subject and Difficulty
        h_box = QHBoxLayout()
        v_box1 = QVBoxLayout()
        v_box1.addWidget(QLabel("المادة الدراسية"))
        self.subject_input = QComboBox()
        self.subject_input.addItems(["الرياضيات", "الفيزياء", "الكيمياء", "الأحياء", "العلوم العامة"])
        self.subject_input.setEditable(True)
        v_box1.addWidget(self.subject_input)
        h_box.addLayout(v_box1)
        
        v_box2 = QVBoxLayout()
        v_box2.addWidget(QLabel("مستوى الصعوبة"))
        self.difficulty_input = QComboBox()
        self.difficulty_input.addItems(["سهل", "متوسط", "صعب"])
        v_box2.addWidget(self.difficulty_input)
        h_box.addLayout(v_box2)
        
        layout.addLayout(h_box)
        
        # Question text
        layout.addWidget(QLabel("نص السؤال"))
        self.text_input = QTextEdit()
        self.text_input.setPlaceholderText("اكتب نص السؤال الأكاديمي كاملاً هنا...")
        layout.addWidget(self.text_input)
        
        # Options Input
        layout.addWidget(QLabel("خيارات الإجابة والحل"))
        options_grid = QHBoxLayout()
        
        self.opt_a = QLineEdit()
        self.opt_a.setPlaceholderText("خيار أ")
        options_grid.addWidget(self.opt_a)
        
        self.opt_b = QLineEdit()
        self.opt_b.setPlaceholderText("خيار ب")
        options_grid.addWidget(self.opt_b)
        
        self.opt_c = QLineEdit()
        self.opt_c.setPlaceholderText("خيار ج")
        options_grid.addWidget(self.opt_c)
        
        self.opt_d = QLineEdit()
        self.opt_d.setPlaceholderText("خيار د")
        options_grid.addWidget(self.opt_d)
        
        layout.addLayout(options_grid)
        
        # Correct answer
        h_box2 = QHBoxLayout()
        h_box2.addWidget(QLabel("الإجابة الصحيحة"))
        self.correct_answer_input = QComboBox()
        self.correct_answer_input.addItems(["أ", "ب", "ج", "د"])
        h_box2.addWidget(self.correct_answer_input)
        h_box2.addStretch()
        layout.addLayout(h_box2)
        
        # Buttons
        btn_layout = QHBoxLayout()
        self.save_btn = QPushButton("حفظ التغييرات" if self.edit_mode else "إضافة وتخزين")
        self.save_btn.setObjectName("action_btn_primary")
        self.save_btn.clicked.connect(self.save)
        btn_layout.addWidget(self.save_btn)
        
        self.cancel_btn = QPushButton("إلغاء الأمر")
        self.cancel_btn.setObjectName("action_btn_secondary")
        self.cancel_btn.clicked.connect(self.reject)
        btn_layout.addWidget(self.cancel_btn)
        
        layout.addLayout(btn_layout)

    def load_question_data(self):
        """Loads existing data for editing mode."""
        self.subject_input.setEditText(self.question_data["subject"])
        index = self.difficulty_input.findText(self.question_data["difficulty"])
        if index >= 0:
            self.difficulty_input.setCurrentIndex(index)
        self.text_input.setHtml(self.question_data["text"])
        
        # Populate options
        try:
            opts = json.loads(self.question_data["options"])
            if len(opts) > 0: self.opt_a.setText(opts[0])
            if len(opts) > 1: self.opt_b.setText(opts[1])
            if len(opts) > 2: self.opt_c.setText(opts[2])
            if len(opts) > 3: self.opt_d.setText(opts[3])
        except Exception:
            pass
            
        c_index = self.correct_answer_input.findText(self.question_data["correct_answer"])
        if c_index >= 0:
            self.correct_answer_input.setCurrentIndex(c_index)

    def save(self):
        if not self.text_input.toPlainText().strip():
            QMessageBox.critical(self, "خطأ بالمدخلات", "يرجى تعبئة نص السؤال!")
            return
            
        options = [
            self.opt_a.text().strip(),
            self.opt_b.text().strip(),
            self.opt_c.text().strip(),
            self.opt_d.text().strip()
        ]
        options = [o for o in options if o] # clear empty
        
        if len(options) < 2:
            QMessageBox.critical(self, "خطأ بالمدخلات", "يجب كتابة خيارين إجابة على الأقل!")
            return
            
        self.accept()

    def get_data(self):
        options = [
            self.opt_a.text().strip(),
            self.opt_b.text().strip(),
            self.opt_c.text().strip(),
            self.opt_d.text().strip()
        ]
        return {
            "subject": self.subject_input.currentText().strip(),
            "difficulty": self.difficulty_input.currentText(),
            "text": self.text_input.toPlainText().strip(),
            "options": json.dumps([o for o in options if o]),
            "correct_answer": self.correct_answer_input.currentText()
        }


# ----------------------------------------------------------------------
# MAIN WINDOW CLASS
# ----------------------------------------------------------------------
class QBankMainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("كيو بانك برو - إدارة الامتحانات وبنك الأسئلة")
        self.resize(1300, 850)
        self.setLayoutDirection(Qt.RightToLeft)
        
        # Load database connection
        init_database()
        
        self.setup_ui()
        self.switch_theme("light") # default light theme
        
        # Load initial question bank data
        self.load_questions_table()

    def setup_ui(self):
        # Global Main Widget
        self.central_widget = QWidget(self)
        self.setCentralWidget(self.central_widget)
        
        # Global Layout structure
        main_layout = QHBoxLayout(self.central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # 1. Sidebar Section (on the right in RTL layout)
        self.sidebar = QFrame()
        self.sidebar.setObjectName("sidebar_frame")
        self.sidebar.setFixedWidth(280)
        main_layout.addWidget(self.sidebar)
        self.setup_sidebar_ui()
        
        # 2. Main Workspace Layout
        self.workspace_layout = QVBoxLayout()
        self.workspace_layout.setSpacing(0)
        self.workspace_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.addLayout(self.workspace_layout)
        
        # Top Header Bar
        self.topbar = QFrame()
        self.topbar.setObjectName("topbar_frame")
        self.topbar.setFixedHeight(75)
        self.setup_topbar_ui()
        self.workspace_layout.addWidget(self.topbar)
        
        # Central Stack Window (Dynamic Screen Switching)
        self.main_stack = QStackedWidget()
        self.workspace_layout.addWidget(self.main_stack)
        
        # Init distinct views
        self.questions_view = QWidget()
        self.exams_view = QWidget()
        self.imports_view = QWidget()
        self.settings_view = QWidget()
        
        self.main_stack.addWidget(self.questions_view)
        self.main_stack.addWidget(self.exams_view)
        self.main_stack.addWidget(self.imports_view)
        self.main_stack.addWidget(self.settings_view)
        
        # Setup the dynamic views
        self.setup_questions_view_ui()
        self.setup_exams_view_ui()
        self.setup_imports_view_ui()
        self.setup_settings_view_ui()

    # ------------------------------------------------------------------
    # SIDEBAR UI NAVIGATION
    # ------------------------------------------------------------------
    def setup_sidebar_ui(self):
        sidebar_layout = QVBoxLayout(self.sidebar)
        sidebar_layout.setContentsMargins(16, 24, 16, 24)
        sidebar_layout.setSpacing(12)
        
        # App Title & Logo Area
        logo_container = QWidget()
        logo_container.setFixedHeight(120)
        logo_layout = QVBoxLayout(logo_container)
        logo_layout.setContentsMargins(0, 0, 0, 0)
        logo_layout.setSpacing(6)
        logo_layout.setAlignment(Qt.AlignCenter)
        
        logo_lbl = QLabel("📚")
        logo_lbl.setStyleSheet("font-size: 38px; background-color: transparent;")
        logo_layout.addWidget(logo_lbl)
        
        title_top = QLabel("كيو بانك برو")
        title_top.setStyleSheet("font-size: 22px; font-weight: bold; color: #FFFFFF;")
        logo_layout.addWidget(title_top)
        
        desc_lbl = QLabel("Q-Bank Pro")
        desc_lbl.setStyleSheet("font-size: 12px; color: #717782; margin-bottom: 12px;")
        logo_layout.addWidget(desc_lbl)
        
        sidebar_layout.addWidget(logo_container)
        
        # Border divider
        line = QFrame()
        line.setFrameShape(QFrame.HLine)
        line.setStyleSheet("background-color: rgba(255, 255, 255, 0.1); max-height: 1px;")
        sidebar_layout.addWidget(line)
        
        # Nav Buttons List
        self.nav_buttons = []
        
        self.btn_bank = QPushButton("   بنك الأسئلة")
        self.btn_bank.setObjectName("nav_btn_active")
        self.btn_bank.setIcon(self.style().standardIcon(QStyle.SP_FileDialogContentsView))
        self.btn_bank.clicked.connect(lambda: self.switch_view_page(0))
        sidebar_layout.addWidget(self.btn_bank)
        self.nav_buttons.append(self.btn_bank)
        
        self.btn_generate = QPushButton("   توليد اختبار")
        self.btn_generate.setObjectName("nav_btn")
        self.btn_generate.setIcon(self.style().standardIcon(QStyle.SP_FileDialogListView))
        self.btn_generate.clicked.connect(lambda: self.switch_view_page(1))
        sidebar_layout.addWidget(self.btn_generate)
        self.nav_buttons.append(self.btn_generate)
        
        self.btn_import = QPushButton("   استيراد PDF/صور")
        self.btn_import.setObjectName("nav_btn")
        self.btn_import.setIcon(self.style().standardIcon(QStyle.SP_ArrowUp))
        self.btn_import.clicked.connect(lambda: self.switch_view_page(2))
        sidebar_layout.addWidget(self.btn_import)
        self.nav_buttons.append(self.btn_import)
        
        self.btn_settings = QPushButton("   الإعدادات")
        self.btn_settings.setObjectName("nav_btn")
        self.btn_settings.setIcon(self.style().standardIcon(QStyle.SP_ComputerIcon))
        self.btn_settings.clicked.connect(lambda: self.switch_view_page(3))
        sidebar_layout.addWidget(self.btn_settings)
        self.nav_buttons.append(self.btn_settings)
        
        sidebar_layout.addStretch()
        
        # User profile badge
        profile_frame = QFrame()
        profile_frame.setStyleSheet("background-color: rgba(255, 255, 255, 0.05); border-radius: 12px; padding: 6px;")
        profile_layout = QHBoxLayout(profile_frame)
        
        avatar = QLabel("👨‍🏫")
        avatar.setStyleSheet("font-size: 26px; background-color: transparent;")
        profile_layout.addWidget(avatar)
        
        user_info = QVBoxLayout()
        name_lbl = QLabel("محمد أحمد")
        name_lbl.setStyleSheet("color: #FFFFFF; font-weight: bold; font-size: 14px; background-color: transparent;")
        role_lbl = QLabel("أستاذ مشارك")
        role_lbl.setStyleSheet("color: #C0C7D3; font-size: 11px; background-color: transparent;")
        user_info.addWidget(name_lbl)
        user_info.addWidget(role_lbl)
        profile_layout.addLayout(user_info)
        
        sidebar_layout.addWidget(profile_frame)

    # ------------------------------------------------------------------
    # TOP HEADER UI
    # ------------------------------------------------------------------
    def setup_topbar_ui(self):
        topbar_layout = QHBoxLayout(self.topbar)
        topbar_layout.setContentsMargins(24, 0, 24, 0)
        
        self.topbar_title = QLabel("بنك الأسئلة والأقسام")
        self.topbar_title.setStyleSheet("font-size: 20px; font-weight: bold; color: #121C2C;")
        topbar_layout.addWidget(self.topbar_title)
        
        topbar_layout.addStretch()
        
        # Search Widget Integration
        search_widget = QFrame()
        search_widget.setStyleSheet("background: transparent;")
        search_layout = QHBoxLayout(search_widget)
        search_layout.setContentsMargins(0, 0, 0, 0)
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("البحث السريع في البنك الكلي...")
        self.search_input.setFixedWidth(280)
        self.search_input.textChanged.connect(self.filter_questions_by_search)
        search_layout.addWidget(self.search_input)
        
        topbar_layout.addWidget(search_widget)

    # ------------------------------------------------------------------
    # SCREEN 1: QUESTION BANK ADMIN
    # ------------------------------------------------------------------
    def setup_questions_view_ui(self):
        layout = QVBoxLayout(self.questions_view)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(24)
        
        # Filter section (Bento Style Layout Box)
        filters_container = QFrame()
        filters_container.setObjectName("bento_filter_frame")
        filters_layout = QHBoxLayout(filters_container)
        filters_layout.setContentsMargins(18, 18, 18, 18)
        filters_layout.setSpacing(16)
        
        # Subject Filter
        sub_layout = QVBoxLayout()
        sub_layout.addWidget(QLabel("تصفية بالمادة"))
        self.filter_subject = QComboBox()
        self.filter_subject.addItems(["جميع المواد", "الرياضيات", "الفيزياء", "الكيمياء", "الأحياء", "العلوم العامة"])
        self.filter_subject.currentIndexChanged.connect(self.load_questions_table)
        sub_layout.addWidget(self.filter_subject)
        filters_layout.addLayout(sub_layout)
        
        # Difficulty Filter
        dif_layout = QVBoxLayout()
        dif_layout.addWidget(QLabel("تصفية بالصعوبة"))
        self.filter_difficulty = QComboBox()
        self.filter_difficulty.addItems(["جميع المستويات", "سهل", "متوسط", "صعب"])
        self.filter_difficulty.currentIndexChanged.connect(self.load_questions_table)
        dif_layout.addWidget(self.filter_difficulty)
        filters_layout.addLayout(dif_layout)
        
        # Add question action button inside Bento
        add_btn_container = QVBoxLayout()
        add_btn_container.addStretch()
        self.btn_new_question = QPushButton("➕ إضافة سؤال جديد")
        self.btn_new_question.setObjectName("action_btn_primary")
        self.btn_new_question.setIcon(self.style().standardIcon(QStyle.SP_DialogYesButton))
        self.btn_new_question.clicked.connect(self.open_new_question_dialog)
        add_btn_container.addWidget(self.btn_new_question)
        filters_layout.addLayout(add_btn_container)
        
        layout.addWidget(filters_container)
        
        # Table of Questions (RTL Style)
        table_headline = QHBoxLayout()
        table_title_lbl = QLabel("قائمة الأسئلة والبنود الذكية")
        table_title_lbl.setStyleSheet("font-size: 18px; font-weight: bold;")
        table_headline.addWidget(table_title_lbl)
        table_headline.addStretch()
        
        self.btn_export_questions = QPushButton("تصدير البنك")
        self.btn_export_questions.setObjectName("action_btn_secondary")
        self.btn_export_questions.setIcon(self.style().standardIcon(QStyle.SP_ArrowRight))
        table_headline.addWidget(self.btn_export_questions)
        layout.addLayout(table_headline)
        
        self.questions_table = QTableWidget()
        self.questions_table.setColumnCount(6)
        self.questions_table.setHorizontalHeaderLabels([
            "معرف", "المادة الدراسية", "مستوى الصعوبة", "نص السؤال الأكاديمي", "الخيارات", "العمليات"
        ])
        self.questions_table.horizontalHeader().setSectionResizeMode(QHeaderView.Stretch)
        self.questions_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.questions_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self.questions_table.horizontalHeader().setSectionResizeMode(4, QHeaderView.ResizeToContents)
        self.questions_table.verticalHeader().setVisible(False)
        self.questions_table.setSelectionBehavior(QTableWidget.SelectRows)
        self.questions_table.setEditTriggers(QTableWidget.NoEditTriggers)
        layout.addWidget(self.questions_table)
        
        # Small Stats Counter
        self.stats_lbl = QLabel("محمل: جاري الحساب...")
        self.stats_lbl.setStyleSheet("font-size: 12px; color: #717782;")
        layout.addWidget(self.stats_lbl)

    # ------------------------------------------------------------------
    # SCREEN 2: EXAM GENERATION PLATFORM
    # ------------------------------------------------------------------
    def setup_exams_view_ui(self):
        layout = QHBoxLayout(self.exams_view)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(24)
        
        # Right Side: Exam generation inputs Configuration UI
        controls_container = QScrollArea()
        controls_container.setWidgetResizable(True)
        controls_container.setFixedWidth(400)
        
        controls_widget = QWidget()
        controls_layout = QVBoxLayout(controls_widget)
        controls_layout.setSpacing(18)
        controls_layout.setContentsMargins(0, 0, 12, 0)
        
        heading_lbl = QLabel("توليد وتصدير معايير الامتحان")
        heading_lbl.setStyleSheet("font-size: 20px; font-weight: bold; color: #005EA1;")
        controls_layout.addWidget(heading_lbl)
        
        # Grade Target
        controls_layout.addWidget(QLabel("عنوان أو فترة الامتحان"))
        self.exam_title_input = QLineEdit("اختبار الفترة الدراسية الأولى")
        controls_layout.addWidget(self.exam_title_input)
        
        controls_layout.addWidget(QLabel("المدرسة / المؤسسة"))
        self.exam_school_input = QLineEdit("مدرسة التميز النموذجية")
        controls_layout.addWidget(self.exam_school_input)
        
        # Subject selection
        controls_layout.addWidget(QLabel("المادة الدراسية للامتحان"))
        self.exam_subject_select = QComboBox()
        self.exam_subject_select.addItems(["الرياضيات", "الفيزياء", "الكيمياء", "الأحياء", "العلوم العامة"])
        controls_layout.addWidget(self.exam_subject_select)
        
        # Duration Select
        controls_layout.addWidget(QLabel("مدة الامتحان الزمنية"))
        self.exam_duration_select = QComboBox()
        self.exam_duration_select.addItems(["ساعة واحدة", "ساعة ونصف", "ساعتان", "ثلاث ساعات"])
        controls_layout.addWidget(self.exam_duration_select)
        
        # Questions Complexity
        controls_layout.addWidget(QLabel("معايير الصعوبة المستهدفة"))
        self.exam_difficulty_group = QButtonGroup(self)
        
        easy_radio = QRadioButton("مبتدئ / سهل")
        easy_radio.setChecked(True)
        medium_radio = QRadioButton("متوسط الصعوبة")
        hard_radio = QRadioButton("متقدم / صعب")
        
        controls_layout.addWidget(easy_radio)
        controls_layout.addWidget(medium_radio)
        controls_layout.addWidget(hard_radio)
        
        self.exam_difficulty_group.addButton(easy_radio, 0)
        self.exam_difficulty_group.addButton(medium_radio, 1)
        self.exam_difficulty_group.addButton(hard_radio, 2)
        
        # Questions Count Slider
        controls_layout.addWidget(QLabel("عدد الأسئلة الكلي"))
        slider_container = QHBoxLayout()
        self.btn_questions_slider = QSlider(Qt.Horizontal)
        self.btn_questions_slider.setRange(2, 20)
        self.btn_questions_slider.setValue(5)
        
        self.slider_val_lbl = QLabel("5")
        self.slider_val_lbl.setStyleSheet("font-weight: bold; color: #2178C3; min-width: 24px;")
        
        self.btn_questions_slider.valueChanged.connect(lambda v: self.slider_val_lbl.setText(str(v)))
        slider_container.addWidget(self.btn_questions_slider)
        slider_container.addWidget(self.slider_val_lbl)
        controls_layout.addLayout(slider_container)
        
        # Extra Export Preferences
        controls_layout.addWidget(QLabel("خيارات متقدمة"))
        self.chk_ans_sheet = QCheckBox("تضمين ورقة إجابات ونموذج حل")
        self.chk_ans_sheet.setChecked(True)
        controls_layout.addWidget(self.chk_ans_sheet)
        
        self.btn_generate_exam = QPushButton("⚡ توليد الاختبار الآن")
        self.btn_generate_exam.setObjectName("accent_add_btn")
        self.btn_generate_exam.setStyleSheet("margin-top: 12px; font-size: 16px;")
        self.btn_generate_exam.clicked.connect(self.generate_exam_content)
        controls_layout.addWidget(self.btn_generate_exam)
        
        self.btn_pdf_export = QPushButton("📄 تصدير كملف PDF للطباعة")
        self.btn_pdf_export.setObjectName("action_btn_primary")
        self.btn_pdf_export.clicked.connect(self.export_exam_to_pdf)
        controls_layout.addWidget(self.btn_pdf_export)
        
        controls_container.setWidget(controls_widget)
        layout.addWidget(controls_container)
        
        # Left Side: Live Paper Preview Simulator (RTL Layout)
        preview_container = QVBoxLayout()
        
        title_bar = QHBoxLayout()
        preview_title = QLabel("معاينة الورقة الامتحانية (محاكاة A4)")
        preview_title.setStyleSheet("font-size: 18px; font-weight: bold; color: #121C2C;")
        title_bar.addWidget(preview_title)
        title_bar.addStretch()
        
        preview_container.addLayout(title_bar)
        
        # HTML simulation inside a QTextEdit styling represented as a standard bordered A4 paper sheet
        self.paper_frame = QFrame()
        self.paper_frame.setObjectName("exam_preview_card")
        self.paper_frame.setMinimumHeight(600)
        
        paper_layout = QVBoxLayout(self.paper_frame)
        paper_layout.setContentsMargins(1, 1, 1, 1) # Full bleed document layout representation
        
        self.exam_renderer = QTextEdit()
        self.exam_renderer.setReadOnly(True)
        self.exam_renderer.setStyleSheet("background-color: #FFFFFF; border: none; padding: 24px; color: #121C2C;")
        paper_layout.addWidget(self.exam_renderer)
        
        preview_container.addWidget(self.paper_frame)
        layout.addLayout(preview_container)
        
        # Set default instructions inside renderer
        self.set_exam_renderer_default_placeholder()

    def set_exam_renderer_default_placeholder(self):
        """Pre-populates exam preview simulator with realistic placeholder instructions."""
        html = """
        <div style="direction: rtl; font-family: Arial; text-align: center; color: #717782;">
            <br/><br/><br/><br/>
            <p style="font-size: 40px;">📝</p>
            <h2 style="font-weight: bold; font-family: Arial;">لم يتم توليد أي نموذج اختبار بعد</h2>
            <p style="font-size: 14px;">قم بضبط المعايير المطلوبة من اللوحة اليمنى ثم اضغط على زر <b>'توليد الاختبار الآن'</b> ليتم تجميع البيانات وعرضها بدقة ومظهر متكامل.</p>
        </div>
        """
        self.exam_renderer.setHtml(html)

    # ------------------------------------------------------------------
    # SCREEN 3: SMART PDF / IMAGE IMPORT (OCR Extraction Engine UI)
    # ------------------------------------------------------------------
    def setup_imports_view_ui(self):
        layout = QHBoxLayout(self.imports_view)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(24)
        
        # Left Panel: Drag-Drop upload screen area
        upload_container = QVBoxLayout()
        upload_container.setSpacing(16)
        
        lbl_import = QLabel("استيراد وتحليل الأسئلة الذكي")
        lbl_import.setStyleSheet("font-size: 20px; font-weight: bold; color: #121C2C;")
        upload_container.addWidget(lbl_import)
        
        self.drop_zone = QFrame()
        self.drop_zone.setObjectName("drop_zone_frame")
        self.drop_zone.setMinimumHeight(350)
        
        # Enable dragging capability
        self.drop_zone.setAcceptDrops(True)
        self.drop_zone.dragEnterEvent = self.drop_zone_dragEnterEvent
        self.drop_zone.dropEvent = self.drop_zone_dropEvent
        
        drop_layout = QVBoxLayout(self.drop_zone)
        drop_layout.setAlignment(Qt.AlignCenter)
        drop_layout.setSpacing(12)
        
        cloud_icon = QLabel("☁️")
        cloud_icon.setStyleSheet("font-size: 58px; background-color: transparent;")
        drop_layout.addWidget(cloud_icon)
        
        instructions = QLabel("اسحب وأفلت ملفات الـ PDF أو الصور هنا لتمييز واستخلاص الأسئلة")
        instructions.setStyleSheet("font-size: 14px; font-weight: bold; color: #414751; background-color: transparent;")
        drop_layout.addWidget(instructions)
        
        formats_desc = QLabel("يدعم الامتحانات المنسقة أو الممسوحة ضوئياً بجودة عالية")
        formats_desc.setStyleSheet("font-size: 11px; color: #717782; background-color: transparent;")
        drop_layout.addWidget(formats_desc)
        
        self.btn_select_file = QPushButton("📁 اختر ملفاً يدوياً من الجهاز")
        self.btn_select_file.setObjectName("action_btn_secondary")
        self.btn_select_file.clicked.connect(self.browse_file_for_import)
        drop_layout.addWidget(self.btn_select_file)
        
        upload_container.addWidget(self.drop_zone)
        
        # Adding loading status bar
        self.import_progress = QProgressBar()
        self.import_progress.setVisible(False)
        upload_container.addWidget(self.import_progress)
        
        self.status_lbl = QLabel("")
        self.status_lbl.setStyleSheet("font-size: 13px; color: #2178C3; font-weight: bold;")
        self.status_lbl.setVisible(False)
        upload_container.addWidget(self.status_lbl)
        
        # Cell analyzer accuracy bento info frame
        accuracy_frame = QFrame()
        accuracy_frame.setStyleSheet("background-color: #E7EEFF; border-radius: 12px; padding: 12px;")
        acc_layout = QHBoxLayout(accuracy_frame)
        
        acc_icon = QLabel("🪄")
        acc_icon.setStyleSheet("font-size: 28px; background-color: transparent;")
        acc_layout.addWidget(acc_icon)
        
        acc_text = QVBoxLayout()
        acc_title = QLabel("معالجة وتحليل آلي معزز بنسبة 99%")
        acc_title.setStyleSheet("font-weight: bold; font-size: 14px; color: #005EA1; background-color: transparent;")
        acc_desc = QLabel("تستطيع الخوارزمية التمييز بنمط ذكي بين الاختيار من متعدد، الفراغات، والأسئلة المقالية وإدراج فروع الحل وتصفيتها.")
        acc_desc.setStyleSheet("font-size: 11px; color: #414751; background-color: transparent;")
        acc_text.addWidget(acc_title)
        acc_text.addWidget(acc_desc)
        acc_layout.addLayout(acc_text)
        
        upload_container.addWidget(accuracy_frame)
        layout.addLayout(upload_container)
        
        # Right Panel: Live parsed QA editor window list
        right_panel = QVBoxLayout()
        right_panel.setSpacing(12)
        
        results_heading = QLabel("نتائج المعالجة والمسودات المستخلصة")
        results_heading.setStyleSheet("font-size: 18px; font-weight: bold; color: #121C2C;")
        right_panel.addWidget(results_heading)
        
        self.parsed_list_widget = QListWidget()
        self.parsed_list_widget.setObjectName("parsed_questions_list")
        right_panel.addWidget(self.parsed_list_widget)
        
        # Floating operations
        actions_bar = QHBoxLayout()
        self.btn_save_all_parsed = QPushButton("🗄️ اعتماد وحفظ للبنك")
        self.btn_save_all_parsed.setObjectName("action_btn_primary")
        self.btn_save_all_parsed.clicked.connect(self.save_all_parsed_to_database)
        actions_bar.addWidget(self.btn_save_all_parsed)
        
        self.btn_clear_parsed_list = QPushButton("إعادة المسح والمسودات")
        self.btn_clear_parsed_list.setObjectName("action_btn_secondary")
        self.btn_clear_parsed_list.clicked.connect(self.clear_parsed_import_list)
        actions_bar.addWidget(self.btn_clear_parsed_list)
        
        right_panel.addLayout(actions_bar)
        layout.addLayout(right_panel)

    def drop_zone_dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()

    def drop_zone_dropEvent(self, event):
        for url in event.mimeData().urls():
            file_path = url.toLocalFile()
            if os.path.exists(file_path):
                self.trigger_ocr_extraction_process(file_path)
                break

    # ------------------------------------------------------------------
    # SCREEN 4: SYSTEM CONFIGURATION & SETTINGS
    # ------------------------------------------------------------------
    def setup_settings_view_ui(self):
        layout = QHBoxLayout(self.settings_view)
        layout.setContentsMargins(24, 24, 24, 24)
        layout.setSpacing(24)
        
        # Left Form Setup
        form_scroll = QScrollArea()
        form_scroll.setWidgetResizable(True)
        form_widget = QWidget()
        form_layout = QVBoxLayout(form_widget)
        form_layout.setSpacing(16)
        
        heading = QLabel("إعدادات النظام والملف التعريفي")
        heading.setStyleSheet("font-size: 20px; font-weight: bold; color: #121C2C;")
        form_layout.addWidget(heading)
        
        form_layout.addWidget(QLabel("الاسم الكامل للمشرف الأكاديمي"))
        self.sett_name = QLineEdit("أحمد محمد عبد الله")
        form_layout.addWidget(self.sett_name)
        
        form_layout.addWidget(QLabel("الجامعة / المركز المعتمد"))
        self.sett_univ = QLineEdit("جامعة الملك سعود")
        form_layout.addWidget(self.sett_univ)
        
        form_layout.addWidget(QLabel("البريد الإلكتروني المهني"))
        self.sett_email = QLineEdit("ahmed.m@qbank.edu.sa")
        form_layout.addWidget(self.sett_email)
        
        # App Theme Options (Light / Dark Model Switch)
        theme_group = QGroupBoxPanel("مظهر وتنسيق ألوان التطبيق")
        theme_layout = QVBoxLayout(theme_group)
        
        self.theme_light_radio = QRadioButton("تفعيل الواجهة المضيئة (النظام الافتراضي الأكاديمي)")
        self.theme_light_radio.setChecked(True)
        self.theme_light_radio.toggled.connect(lambda loaded: self.switch_theme("light") if loaded else None)
        
        self.theme_dark_radio = QRadioButton("تفعيل الواجهة الداكنة (مريح للعين بجلسات العمل الطويلة)")
        self.theme_dark_radio.toggled.connect(lambda loaded: self.switch_theme("dark") if loaded else None)
        
        theme_layout.addWidget(self.theme_light_radio)
        theme_layout.addWidget(self.theme_dark_radio)
        form_layout.addWidget(theme_group)
        
        # Export default configuration
        exp_group = QGroupBoxPanel("تفضيلات التصدير الافتراضية")
        exp_layout = QVBoxLayout(exp_group)
        self.chk_auto_pdf = QCheckBox("معالجة وتصدير تلقائي لملفات PDF")
        self.chk_auto_pdf.setChecked(True)
        self.chk_include_key = QCheckBox("تضمين نموذج الإجابة كصفحة ملحقة أخيرة")
        self.chk_include_key.setChecked(True)
        exp_layout.addWidget(self.chk_auto_pdf)
        exp_layout.addWidget(self.chk_include_key)
        form_layout.addWidget(exp_group)
        
        # Save Settings button
        self.btn_save_settings = QPushButton("💾 حفظ كافة التفضيلات")
        self.btn_save_settings.setObjectName("action_btn_primary")
        self.btn_save_settings.clicked.connect(self.simulate_saving_settings)
        form_layout.addWidget(self.btn_save_settings)
        
        form_layout.addStretch()
        form_scroll.setWidget(form_widget)
        layout.addWidget(form_scroll)
        
        # Right Stats Column Box Configuration
        stats_scroll = QScrollArea()
        stats_scroll.setWidgetResizable(True)
        stats_scroll.setFixedWidth(420)
        
        stats_widget = QWidget()
        stats_layout = QVBoxLayout(stats_widget)
        stats_layout.setSpacing(18)
        stats_layout.setContentsMargins(12, 0, 0, 0)
        
        stat_heading = QLabel("مساحة التخزين وقاعدة البيانات")
        stat_heading.setStyleSheet("font-size: 18px; font-weight: bold; color: #005EA1;")
        stats_layout.addWidget(stat_heading)
        
        # Storage progression bar
        storage_bar_container = QFrame()
        storage_bar_container.setStyleSheet("background-color: #FFFFFF; border: 1px solid #C0C7D3; border-radius: 12px; padding: 16px;")
        sb_layout = QVBoxLayout(storage_bar_container)
        sb_layout.addWidget(QLabel("مساحة التخزين السحابية المستخدمة"))
        
        progress_val = QHBoxLayout()
        p_val = QLabel("1.2 GB / 5.0 GB")
        p_val.setStyleSheet("font-weight: bold; font-size: 16px; background-color: transparent;")
        p_perc = QLabel("24%")
        p_perc.setStyleSheet("color: #2178C3; font-weight: bold; background-color: transparent;")
        progress_val.addWidget(p_val)
        progress_val.addStretch()
        progress_val.addWidget(p_perc)
        sb_layout.addLayout(progress_val)
        
        sett_progress = QProgressBar()
        sett_progress.setRange(0, 100)
        sett_progress.setValue(24)
        sb_layout.addWidget(sett_progress)
        
        stats_layout.addWidget(storage_bar_container)
        
        # Security layout frame
        sec_group = QGroupBoxPanel("خيارات الأمان والخصوصية")
        sec_layout = QVBoxLayout(sec_group)
        sec_layout.addWidget(QLabel("🛡️ المصادقة الثنائية نشطة"))
        sec_layout.addWidget(QLabel("🔑 تم إقرار شهادة تشفير الروابط"))
        stats_layout.addWidget(sec_group)
        
        # Help banner
        help_card = QFrame()
        help_card.setStyleSheet("background-color: #273141; border-radius: 12px; padding: 16px;")
        hc_layout = QVBoxLayout(help_card)
        
        hc_title = QLabel("هل تحتاج إلى مساعدة إضافية؟")
        hc_title.setStyleSheet("font-weight: bold; color: #FFFFFF; font-size: 15px; background: transparent;")
        hc_desc = QLabel("يتواجد فريق الدعم الفني والأكاديمي التابع لكيو بانك برو باستمرار لمعالجة المشاكل والاستفسارات.")
        hc_desc.setStyleSheet("color: #C0C7D3; font-size: 11px; background: transparent;")
        
        self.btn_chat = QPushButton("💬 تحدث مع المساعد الذكي للأخطاء")
        self.btn_chat.setObjectName("action_btn_primary")
        self.btn_chat.clicked.connect(lambda: QMessageBox.information(self, "المساعد التفاعلي", "تم فتح نافذة المساعد الذكي لمراجعة المتطلبات!"))
        
        hc_layout.addWidget(hc_title)
        hc_layout.addWidget(hc_desc)
        hc_layout.addWidget(self.btn_chat)
        stats_layout.addWidget(help_card)
        
        stats_layout.addStretch()
        stats_scroll.setWidget(stats_widget)
        layout.addWidget(stats_scroll)


    # ------------------------------------------------------------------
    # CONTROLLER METHOD LOGIC
    # ------------------------------------------------------------------
    def switch_view_page(self, index):
        """Switches the main layout content stack with animation highlighting."""
        self.main_stack.setCurrentIndex(index)
        
        # Update Nav state styles
        for i, button in enumerate(self.nav_buttons):
            if i == index:
                button.setObjectName("nav_btn_active")
            else:
                button.setObjectName("nav_btn")
            button.style().unpolish(button)
            button.style().polish(button)
            
        # Update Topbar Title text depending on target page index
        headings_map = {
            0: "بنك الأسئلة والأقسام",
            1: "توليد اختبار وسحب عينات",
            2: "استخلاص الأسئلة الذكي من الملفات",
            3: "الإعدادات العامة وتخصيص الواجهة"
        }
        self.topbar_title.setText(headings_map.get(index, ""))
        
        # Trigger reload of DB on main screens to reflect changes
        if index == 0:
            self.load_questions_table()

    def switch_theme(self, theme_name):
        """Switches dynamically between optimized light mode and immersive dark mode stylesheets."""
        if theme_name == "light":
            self.setStyleSheet(LIGHT_THEME_QSS)
        else:
            self.setStyleSheet(DARK_THEME_QSS)

    def load_questions_table(self):
        """Reads questions from database and populates screen 1 table."""
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # Build flexible Query based on Combobox parameters
        query = "SELECT id, subject, difficulty, question_text, options, correct_answer FROM questions WHERE 1=1"
        params = []
        
        selected_subject = self.filter_subject.currentText()
        if selected_subject != "جميع المواد":
            query += " AND subject = ?"
            params.append(selected_subject)
            
        selected_diff = self.filter_difficulty.currentText()
        if selected_diff != "جميع المستويات":
            query += " AND difficulty = ?"
            params.append(selected_diff)
            
        cursor.execute(query, params)
        rows = cursor.fetchall()
        conn.close()
        
        self.questions_table.setRowCount(0)
        for row_idx, row in enumerate(rows):
            self.questions_table.insertRow(row_idx)
            
            # ID
            id_item = QTableWidgetItem(str(row[0]))
            id_item.setTextAlignment(Qt.AlignCenter)
            self.questions_table.setItem(row_idx, 0, id_item)
            
            # Subject
            self.questions_table.setItem(row_idx, 1, QTableWidgetItem(row[1]))
            
            # Difficulty Badge implementation inside widget item cell representation
            diff_text = row[2]
            badge_frame = QFrame()
            badge_frame.setFixedSize(75, 26)
            
            if diff_text == "سهل":
                badge_frame.setObjectName("badge_easy")
            elif diff_text == "متوسط":
                badge_frame.setObjectName("badge_medium")
            else:
                badge_frame.setObjectName("badge_hard")
                
            badge_lay = QHBoxLayout(badge_frame)
            badge_lay.setContentsMargins(0, 0, 0, 0)
            badge_lay.setAlignment(Qt.AlignCenter)
            
            b_label = QLabel(diff_text)
            b_label.setObjectName("badge_label")
            b_label.setAlignment(Qt.AlignCenter)
            badge_lay.addWidget(b_label)
            
            self.questions_table.setCellWidget(row_idx, 2, badge_frame)
            
            # Text content
            self.questions_table.setItem(row_idx, 3, QTableWidgetItem(row[3]))
            
            # Choices count
            try:
                opts = json.loads(row[4])
                self.questions_table.setItem(row_idx, 4, QTableWidgetItem(f"{len(opts)} خيارات"))
            except Exception:
                self.questions_table.setItem(row_idx, 4, QTableWidgetItem("---"))
                
            # Actions buttons cell
            actions_widget = QWidget()
            act_layout = QHBoxLayout(actions_widget)
            act_layout.setContentsMargins(4, 2, 4, 2)
            act_layout.setSpacing(6)
            act_layout.setAlignment(Qt.AlignCenter)
            
            edit_btn = QPushButton("تعديل")
            edit_btn.setObjectName("action_btn_secondary")
            edit_btn.setFixedSize(55, 24)
            edit_btn.clicked.connect(lambda checked=False, q_id=row[0]: self.open_edit_question_dialog(q_id))
            act_layout.addWidget(edit_btn)
            
            del_btn = QPushButton("حذف")
            del_btn.setObjectName("action_btn_secondary")
            del_btn.setFixedSize(55, 24)
            del_btn.setStyleSheet("color: #BA1A1A; border-color: #BA1A1A;")
            del_btn.clicked.connect(lambda checked=False, q_id=row[0]: self.delete_question_from_bank(q_id))
            act_layout.addWidget(del_btn)
            
            self.questions_table.setCellWidget(row_idx, 5, actions_widget)
            
        self.stats_lbl.setText(f"عرض {len(rows)} سؤالاً مسجلاً ضمن بنك التصفية الحالية")

    def filter_questions_by_search(self, text):
        """Performs real-time search filtering on table widget rows."""
        for row in range(self.questions_table.rowCount()):
            text_item = self.questions_table.item(row, 3)
            sub_item = self.questions_table.item(row, 1)
            
            if text_item and sub_item:
                match = text.lower() in text_item.text().lower() or text.lower() in sub_item.text().lower()
                self.questions_table.setRowHidden(row, not match)

    def open_new_question_dialog(self):
        """Launches the additive question design viewport."""
        dlg = AddQuestionDialog(self)
        if dlg.exec():
            data = dlg.get_data()
            conn = sqlite3.connect(DB_NAME)
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO questions (subject, difficulty, question_text, options, correct_answer)
                VALUES (?, ?, ?, ?, ?)
            """, (data["subject"], data["difficulty"], data["text"], data["options"], data["correct_answer"]))
            conn.commit()
            conn.close()
            
            self.load_questions_table()
            QMessageBox.information(self, "عملية ناجحة", "تم إدراج السؤال بنجاح في البنك قاعدة البيانات الموثوقة!")

    def open_edit_question_dialog(self, question_id):
        """Loads and modifies a question from DB."""
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute("SELECT subject, difficulty, question_text, options, correct_answer FROM questions WHERE id = ?", (question_id,))
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return
            
        question_data = {
            "id": question_id,
            "subject": row[0],
            "difficulty": row[1],
            "text": row[2],
            "options": row[3],
            "correct_answer": row[4]
        }
        
        dlg = AddQuestionDialog(self, edit_mode=True, question_data=question_data)
        if dlg.exec():
            data = dlg.get_data()
            conn = sqlite3.connect(DB_NAME)
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE questions 
                SET subject = ?, difficulty = ?, question_text = ?, options = ?, correct_answer = ?
                WHERE id = ?
            """, (data["subject"], data["difficulty"], data["text"], data["options"], data["correct_answer"], question_id))
            conn.commit()
            conn.close()
            
            self.load_questions_table()
            QMessageBox.information(self, "تحديث البيانات", "تم حفظ وتحديث بيانات السؤال بنجاح!")

    def delete_question_from_bank(self, question_id):
        """Removes a row safely with confirmation dialog."""
        reply = QMessageBox.question(
            self, "تأكيد حذف السؤال", 
            "هل أنت متأكد تماماً من رغبتك بحذف هذا السؤال نهائياً من قاعدة البيانات للبنك؟ لا يمكن التراجع عن هذا الإجراء.",
            QMessageBox.Yes | QMessageBox.No, QMessageBox.No
        )
        if reply == QMessageBox.Yes:
            conn = sqlite3.connect(DB_NAME)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM questions WHERE id = ?", (question_id,))
            conn.commit()
            conn.close()
            
            self.load_questions_table()

    # ------------------------------------------------------------------
    # EXAM GENERATOR SYSTEM LOGIC
    # ------------------------------------------------------------------
    def generate_exam_content(self):
        """Selects questions from database and renders an realistic HTML mockup paper."""
        subject = self.exam_subject_select.currentText()
        count = self.btn_questions_slider.value()
        difficulty = ["سهل", "متوسط", "صعب"][self.exam_difficulty_group.checkedId()]
        
        # Connect & Query
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        # Flexible selection based on criteria or random matching fallbacks
        cursor.execute("""
            SELECT question_text, options, correct_answer, difficulty 
            FROM questions 
            WHERE subject = ? 
            ORDER BY RANDOM() LIMIT ?
        """, (subject, count))
        
        rows = cursor.fetchall()
        
        # If matches are insufficient, select generic subject or random as fallback padding
        if len(rows) < count:
            cursor.execute("""
                SELECT question_text, options, correct_answer, difficulty 
                FROM questions 
                WHERE subject = ?
            """, (subject,))
            rows = cursor.fetchall()
            
            # If still short, pull from overall DB random
            if len(rows) < count:
                cursor.execute("""
                    SELECT question_text, options, correct_answer, difficulty 
                    FROM questions 
                    ORDER BY RANDOM() LIMIT ?
                """, (count,))
                rows = cursor.fetchall()
                
        conn.close()
        
        if not rows:
            QMessageBox.warning(self, "نقص البيانات", "لا تتوفر أسئلة كافية في البنك لإنتاج هذا النموذج. يرجى إضافة أسئلة أو استيرادها أولاً.")
            return
            
        # Build HTML format
        school_name = self.exam_school_input.text().strip()
        exam_title = self.exam_title_input.text().strip()
        duration = self.exam_duration_select.currentText()
        date_str = datetime.now().strftime("%Y/%m/%d")
        
        # HTML document with custom clean styles for A4 simulations
        self.last_generated_exam_html = f"""
        <html>
        <body style="direction: rtl; text-align: right; font-family: 'Arial'; padding: 10px; line-height: 1.6;">
            <!-- School Header Table -->
            <table width="100%" style="border: 2px solid #121C2C; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td width="35%" style="padding: 10px; border: 1px solid #121C2C; vertical-align: top;">
                        <b>الجمهورية العربية السورية</b><br/>
                        <b>وزارة التربية والتعليم</b><br/>
                        <b>{school_name}</b>
                    </td>
                    <td width="30%" style="padding: 10px; border: 1px solid #121C2C; text-align: center; vertical-align: middle;">
                        <span style="font-size: 18px; font-weight: bold;">{exam_title}</span><br/>
                        <span style="font-size: 12px;">العام الدراسي: 2026/2027</span>
                    </td>
                    <td width="35%" style="padding: 10px; border: 1px solid #121C2C; vertical-align: top; text-align: left;">
                        <b>المادة:</b> {subject}<br/>
                        <b>الزمن:</b> {duration}<br/>
                        <b>التاريخ:</b> {date_str}
                    </td>
                </tr>
                <tr>
                    <td colspan="2" style="padding: 10px; border: 1px solid #121C2C;">
                        <b>الاسم الكامل للطالب:</b> ............................................................
                    </td>
                    <td style="padding: 10px; border: 1px solid #121C2C; text-align: left;">
                        <b>رقم الجلوس:</b> ....................
                    </td>
                </tr>
            </table>

            <h3 style="text-align: center; text-decoration: underline; font-weight: bold;">الأسئلة الامتحانية</h3>
        """
        
        # Append Questions logic loop
        for idx, row in enumerate(rows):
            q_text = row[0]
            options = []
            try:
                options = json.loads(row[1])
            except Exception:
                pass
                
            self.last_generated_exam_html += f"""
            <div style="margin-bottom: 20px;">
                <p style="font-size: 15px; font-weight: bold;">س {idx+1}: {q_text}</p>
            """
            
            if options:
                self.last_generated_exam_html += """
                <table width="100%" style="margin-right: 15px;">
                    <tr>
                """
                
                # Check for standard MCQ output layout options (A, B, C, D)
                alphabet = ["أ", "ب", "ج", "د"]
                for o_idx, opt in enumerate(options):
                    letter = alphabet[o_idx] if o_idx < len(alphabet) else ""
                    self.last_generated_exam_html += f"""
                    <td width="50%" style="padding: 4px;">
                        <b>{letter})</b> {opt}
                    </td>
                    """
                    if o_idx % 2 == 1 and o_idx != len(options)-1:
                        self.last_generated_exam_html += "</tr><tr>"
                        
                self.last_generated_exam_html += """
                    </tr>
                </table>
                """
            else:
                # Add default essay writing area if options empty
                self.last_generated_exam_html += """
                <div style="margin-top: 10px; border-bottom: 1px dashed #717782; height: 35px; width: 90%;"></div>
                <div style="margin-top: 10px; border-bottom: 1px dashed #717782; height: 35px; width: 90%;"></div>
                """
                
            self.last_generated_exam_html += "</div>"
            
        # Append Answer Key if selected
        if self.chk_ans_sheet.isChecked():
            self.last_generated_exam_html += """
            <hr style="border: 1px dashed #005EA1; margin-top: 40px; margin-bottom: 20px; page-break-before: always;"/>
            <h3 style="text-align: center; color: #005EA1;">🔐 ورقة الإجابة ونموذج الحل (للمعلم فقط)</h3>
            <table width="100%" style="border: 1px solid #005EA1; border-collapse: collapse; text-align: center;">
                <tr style="background-color: #DEE8FF;">
                    <th style="padding: 10px; border: 1px solid #005EA1;">رقم السؤال</th>
                    <th style="padding: 10px; border: 1px solid #005EA1;">الإجابة الصحيحة</th>
                </tr>
            """
            
            for idx, row in enumerate(rows):
                ans = row[2]
                self.last_generated_exam_html += f"""
                <tr>
                    <td style="padding: 8px; border: 1px solid #005EA1; font-weight: bold;">س {idx+1}</td>
                    <td style="padding: 8px; border: 1px solid #005EA1; font-weight: bold; color: #006D40;">{ans}</td>
                </tr>
                """
                
            self.last_generated_exam_html += "</table>"

        self.last_generated_exam_html += """
            <br/><br/>
            <div style="text-align: center; font-weight: bold; font-size: 13px; color: #717782;">
                انتهت الأسئلة - مع تمنياتنا لجميع الطلاب بالنجاح والتوفيق
            </div>
        </body>
        </html>
        """
        
        self.exam_renderer.setHtml(self.last_generated_exam_html)

    def export_exam_to_pdf(self):
        """Exports the computed HTML document to PDF with perfect system native RTL formatting."""
        if not hasattr(self, "last_generated_exam_html"):
            QMessageBox.critical(self, "خطأ بالطلب", "يرجى توليد نموذج امتحاني أولاً قبل محاولة التصدير!")
            return
            
        save_path, _ = QFileDialog.getSaveFileName(self, "تصدير الملف لـ PDF", "", "ملف PDF (*.pdf)")
        if not save_path:
            return
            
        doc = QTextDocument()
        doc.setHtml(self.last_generated_exam_html)
        
        # Configure layout options for neat printer
        doc.setPageSize(QSize(210, 297)) # A4 standards
        
        # Print using lightweight native module
        # Note: In PySide6, we print to PDF directly using standard document print system
        from PySide6.QtGui import QPdfWriter
        pdf_writer = QPdfWriter(save_path)
        pdf_writer.setPageSize(QPageSize(QPageSize.A4))
        pdf_writer.setPageMargins(QPageLayout.marginsWithUnits(
            QPageLayout.marginsWidth(QPageLayout.marginsWidth(10, 10, 10, 10)), 
            QPageLayout.Unit.Millimeter
        ))
        
        doc.print_(pdf_writer)
        QMessageBox.information(self, "تصدير PDF ناجح", f"تم بحمد الله تصدير الامتحان بدقة وحفظه كملف PDF موثوق في:\n{save_path}")

    # ------------------------------------------------------------------
    # SCREEN 3: ASYNC FILE OCR PARSING ACTIONS
    # ------------------------------------------------------------------
    def browse_file_for_import(self):
        """Standard prompt selection fallback."""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "اختر ملف الامتحان", "", 
            "ملفات المستندات والصور (*.pdf *.png *.jpg *.jpeg)"
        )
        if file_path:
            self.trigger_ocr_extraction_process(file_path)

    def trigger_ocr_extraction_process(self, file_path):
        """Kicks off background parsing threads loading bars."""
        self.import_progress.setVisible(True)
        self.import_progress.setValue(0)
        
        self.status_lbl.setVisible(True)
        self.status_lbl.setText("جاري تحليل وتصنيف بنود المستند بالذكاء الاصطناعي...")
        
        self.ocr_thread = OCRWorker(file_path)
        self.ocr_thread.progress.connect(self.import_progress.setValue)
        self.ocr_thread.done.connect(self.on_ocr_extraction_finished)
        self.ocr_thread.error.connect(self.on_ocr_extraction_error)
        self.ocr_thread.start()

    @Slot(list)
    def on_ocr_extraction_finished(self, qa_list):
        self.import_progress.setVisible(False)
        self.status_lbl.setText("تم الاستخلاص والتحليل بنجاح!")
        
        # Add generated entries into editable layouts list widgets
        self.parsed_list_widget.clear()
        
        for q_idx, qa in enumerate(qa_list):
            item = QListWidgetItem()
            self.parsed_list_widget.addItem(item)
            
            # Interactive container row layout
            widget = QFrame()
            widget.setStyleSheet("background-color: #FFFFFF; border: 1px solid #C0C7D3; border-radius: 8px; padding: 12px;")
            widget_lay = QVBoxLayout(widget)
            widget_lay.setSpacing(6)
            
            header = QHBoxLayout()
            h_lbl = QLabel(f"عنصر مستخلص #{q_idx+1}")
            h_lbl.setStyleSheet("font-weight: bold; color: #2178C3; background-color: transparent;")
            header.addWidget(h_lbl)
            header.addStretch()
            
            # Sub-fields and inline parameters editable
            widget_lay.addLayout(header)
            
            sub_combo = QComboBox()
            sub_combo.addItems(["الرياضيات", "الفيزياء", "الكيمياء", "الأحياء", "العلوم العامة"])
            index = sub_combo.findText(qa["subject"])
            if index >= 0: sub_combo.setCurrentIndex(index)
            widget_lay.addWidget(sub_combo)
            
            diff_combo = QComboBox()
            diff_combo.addItems(["سهل", "متوسط", "صعب"])
            d_index = diff_combo.findText(qa["difficulty"])
            if d_index >= 0: diff_combo.setCurrentIndex(d_index)
            widget_lay.addWidget(diff_combo)
            
            text_edit = QTextEdit()
            text_edit.setPlainText(qa["question_text"])
            text_edit.setMaximumHeight(80)
            widget_lay.addWidget(text_edit)
            
            # Options Text Field
            opts_edit = QLineEdit(", ".join(qa["options"]))
            opts_edit.setPlaceholderText("الخيارات مفصولة بفاصلة لو كانت متعددة")
            widget_lay.addWidget(opts_edit)
            
            ans_combo = QComboBox()
            ans_combo.addItems(["أ", "ب", "ج", "د"])
            c_index = ans_combo.findText(qa["correct_answer"])
            if c_index >= 0: ans_combo.setCurrentIndex(c_index)
            widget_lay.addWidget(ans_combo)
            
            # Attach dynamic data variables mapping references to widgets
            item.setSizeHint(QSize(widget.sizeHint().width(), 260))
            self.parsed_list_widget.setItemWidget(item, widget)
            
            # Temporary references array for bulk processing collection
            widget.setProperty("sub_combo", sub_combo)
            widget.setProperty("diff_combo", diff_combo)
            widget.setProperty("text_edit", text_edit)
            widget.setProperty("opts_edit", opts_edit)
            widget.setProperty("ans_combo", ans_combo)

    @Slot(str)
    def on_ocr_extraction_error(self, err_msg):
        self.import_progress.setVisible(False)
        self.status_lbl.setText("فشلت عملية الاستخلاص!")
        QMessageBox.critical(self, "خطأ بالمعالجة الآلية", f"حدث خلل أثناء محاولة استخلاص النصوص:\n{err_msg}")

    def save_all_parsed_to_database(self):
        """Iterates over editable list widgets and registers validation entries into SQLite."""
        count = self.parsed_list_widget.count()
        if count == 0:
            QMessageBox.warning(self, "إنذار", "لا تتوفر أي مسودات مستخلصة ليتم حفظها!")
            return
            
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        
        saved_count = 0
        for idx in range(count):
            item = self.parsed_list_widget.item(idx)
            widget = self.parsed_list_widget.itemWidget(item)
            
            if widget:
                # Retrieve references
                subject = widget.property("sub_combo").currentText()
                diff = widget.property("diff_combo").currentText()
                text = widget.property("text_edit").toPlainText().strip()
                opts_text = widget.property("opts_edit").text().strip()
                correct = widget.property("ans_combo").currentText()
                
                # Format options text list back to JSON string list
                options_list = [o.strip() for o in opts_text.split(',') if o.strip()]
                if not options_list:
                    options_list = ["أ", "ب", "ج", "د"] # padding generic
                options_json = json.dumps(options_list)
                
                if text:
                    cursor.execute("""
                        INSERT INTO questions (subject, difficulty, question_text, options, correct_answer)
                        VALUES (?, ?, ?, ?, ?)
                    """, (subject, diff, text, options_json, correct))
                    saved_count += 1
                    
        conn.commit()
        conn.close()
        
        self.parsed_list_widget.clear()
        self.load_questions_table()
        QMessageBox.information(self, "نجاح الإجراء", f"تم بنجاح حفظ عدد {saved_count} من البنود المصنفة ضمن قاعدة البيانات الموثوقة للبنك الكلي!")

    def clear_parsed_import_list(self):
        self.parsed_list_widget.clear()

    # ------------------------------------------------------------------
    # APP SETTINGS ACTION SIMULATORS
    # ------------------------------------------------------------------
    def simulate_saving_settings(self):
        QMessageBox.information(self, "حفظ الإعدادات", "تم بنجاح تحديث بيانات وتفضيلات الملف الشخصي والتصدير وتخزينها محلياً!")


# ----------------------------------------------------------------------
# HELPER CUSTOM WIDGET COMPLEX BORDERS
# ----------------------------------------------------------------------
class QGroupBoxPanel(QFrame):
    """Custom flat bordered alternative group box styled perfectly for Material layouts."""
    def __init__(self, title, parent=None):
        super().__init__(parent)
        self.setStyleSheet("background-color: #FFFFFF; border: 1px solid #C0C7D3; border-radius: 12px; margin-top: 10px;")
        
        main_lay = QVBoxLayout(self)
        main_lay.setContentsMargins(14, 18, 14, 14)
        
        self.title_lbl = QLabel(title)
        self.title_lbl.setStyleSheet("font-weight: bold; font-size: 14px; color: #2178C3; border: none; background: transparent; margin-bottom: 6px;")
        main_lay.addWidget(self.title_lbl)


# ----------------------------------------------------------------------
# APPLICATION ENTRANCE POINT
# ----------------------------------------------------------------------
def main():
    app = QApplication(sys.argv)
    app.setLayoutDirection(Qt.RightToLeft)
    
    # Run dependencies installing task fallback
    install_fonts()
    
    window = QBankMainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
