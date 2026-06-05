import React, { useState, useEffect, useRef } from "react";
import { 
  Database, 
  FileText, 
  Sparkles, 
  Settings as SettingsIcon, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  Upload, 
  Download, 
  Printer, 
  Check, 
  AlertCircle, 
  X, 
  FileType, 
  ArrowRight,
  Eye,
  EyeOff,
  RefreshCw,
  Clock,
  Award,
  BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Question, Exam, ViewType } from "./types";
import { INITIAL_QUESTIONS } from "./seedData";

import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as ChartTooltip, 
  Legend as ChartLegend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from "recharts";

// Firebase imports
import { auth, db, OperationType, handleFirestoreError } from "./lib/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  query, 
  where, 
  onSnapshot, 
  getDocs, 
  writeBatch 
} from "firebase/firestore";

export default function App() {
  // Authentication states
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [activeView, setActiveView] = useState<ViewType>("questions");
  
  // Searching & Filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSubject, setFilterSubject] = useState("الكل");
  const [filterDifficulty, setFilterDifficulty] = useState("الكل");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // New & Edit Question Modal/Form State
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  
  const [formQuestionText, setFormQuestionText] = useState("");
  const [formSubject, setFormSubject] = useState("الرياضيات");
  const [formDifficulty, setFormDifficulty] = useState<"سهل" | "متوسط" | "صعب">("متوسط");
  const [formOptions, setFormOptions] = useState<string[]>(["", "", "", ""]);
  const [formCorrectAnswer, setFormCorrectAnswer] = useState("أ");

  // AI Import / Generator State
  const [aiMode, setAiMode] = useState<"ocr" | "generate">("ocr");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState("");
  const [aiApiKeyMissing, setAiApiKeyMissing] = useState(false);
  
  // OCR Ingester File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileMimeType, setFileMimeType] = useState<string>("");
  
  // Generate Qs parameters
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiSubject, setAiSubject] = useState("الرياضيات");
  const [aiDifficulty, setAiDifficulty] = useState("متوسط");
  const [aiCount, setAiCount] = useState(5);
  
  // Temporary reviewed AI questions
  const [previewQuestions, setPreviewQuestions] = useState<Question[]>([]);

  // Exam Generation State
  const [examTitle, setExamTitle] = useState("الامتحان المدرسي الموحد");
  const [examSubject, setExamSubject] = useState("الرياضيات");
  const [examDifficulty, setExamDifficulty] = useState("الكل");
  const [examCount, setExamCount] = useState(5);
  const [examDuration, setExamDuration] = useState("60 دقيقة");
  const [showModelAnswers, setShowModelAnswers] = useState(true);
  const [generatedExam, setGeneratedExam] = useState<Exam | null>(null);
  const [selectedLogoType, setSelectedLogoType] = useState<string>("syria");
  const [customLogoUrl, setCustomLogoUrl] = useState<string | null>(null);
  const [examFontSize, setExamFontSize] = useState<"sm" | "md" | "lg" | "xl">("md");

  // States for custom confirmation dialog and dashboard
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showDashboard, setShowDashboard] = useState(true);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    action: () => void | Promise<void>;
    type: "danger" | "warning" | "info";
  } | null>(null);

  // Admin module states
  const [teachers, setTeachers] = useState<any[]>([]);
  const [allTeachersQuestions, setAllTeachersQuestions] = useState<Question[]>([]);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [adminUserSearch, setAdminUserSearch] = useState("");
  const [adminQuestionSearch, setAdminQuestionSearch] = useState("");
  const [deleteTeacherConfirmId, setDeleteTeacherConfirmId] = useState<string | null>(null);

  // Admin automatic fetch of teachers
  useEffect(() => {
    if (user?.email === "admin@qbank.com") {
      fetchTeachers();
    }
  }, [user]);

  const fetchTeachers = async () => {
    if (user?.uid?.startsWith("local-")) {
      setTeachers([
        { id: "local-demo-1", email: "injaz706@gmail.com", createdAt: new Date().toISOString() },
        { id: "local-demo-2", email: "teacher@qbank.com", createdAt: new Date().toISOString() }
      ]);
      return;
    }

    setIsAdminLoading(true);
    try {
      const snap = await getDocs(collection(db, "users"));
      const list: any[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.email !== "admin@qbank.com") {
          list.push({ ...d, id: docSnap.id });
        }
      });
      setTeachers(list);
    } catch (err: any) {
      console.error("Failed to fetch teachers:", err);
      handleFirestoreError(err, OperationType.LIST, "users");
    } finally {
      setIsAdminLoading(false);
    }
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    if (user?.uid?.startsWith("local-")) {
      setTeachers(prev => prev.filter(t => t.id !== teacherId));
      alert("تم بنجاح حذف المعلم المحلي المحاكي!");
      setDeleteTeacherConfirmId(null);
      return;
    }

    setIsAdminLoading(true);
    try {
      // 1. Delete associated questions first
      const qSnap = await getDocs(query(collection(db, "questions"), where("userId", "==", teacherId)));
      const batch = writeBatch(db);
      qSnap.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      // 2. Delete teacher document
      await deleteDoc(doc(db, "users", teacherId));
      
      // Update local state
      setTeachers(prev => prev.filter(t => t.id !== teacherId));
      setAllTeachersQuestions(prev => prev.filter(q => q.userId !== teacherId));
      
      alert("تم بنجاح حذف المعلم وجميع أسئلته ومسوداته من البنك السحابي!");
      setDeleteTeacherConfirmId(null);
    } catch (err: any) {
      console.error("Failed to delete teacher:", err);
      handleFirestoreError(err, OperationType.DELETE, `users/${teacherId}`);
    } finally {
      setIsAdminLoading(false);
    }
  };

  const fetchAllTeachersQuestions = async () => {
    if (user?.uid?.startsWith("local-")) {
      const list = questions.map((q) => ({
        ...q,
        creatorEmail: user.email || "معلم محلي"
      }));
      setAllTeachersQuestions(list);
      alert(`تم بنجاح جلب ومزامنة ${list.length} سؤال من الذاكرة المحلية الاحتياطية!`);
      return;
    }

    setIsAdminLoading(true);
    try {
      const snap = await getDocs(collection(db, "questions"));
      const list: Question[] = [];
      snap.forEach((docSnap) => {
        const d = docSnap.data() as Question;
        // Find teacher email
        const teacher = teachers.find(t => t.id === d.userId);
        list.push({
          ...d,
          id: docSnap.id,
          creatorEmail: teacher ? teacher.email : "معلم تجريبي/غير معروف"
        });
      });
      setAllTeachersQuestions(list);
      alert(`تم بنجاح جلب ومزامنة ${list.length} سؤال من كافة حسابات المعلمين الآخرين!`);
    } catch (err: any) {
      console.error("Failed to fetch all questions:", err);
      handleFirestoreError(err, OperationType.LIST, "questions");
    } finally {
      setIsAdminLoading(false);
    }
  };

  // Subject distribution for dynamic Recharts Pie display
  const subjectData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    questions.forEach(q => {
      const s = q.subject || "أخرى";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [questions]);

  // Difficulty stats distribution for Recharts Bar diagram
  const difficultyData = React.useMemo(() => {
    const counts = { "سهل": 0, "متوسط": 0, "صعب": 0 };
    questions.forEach(q => {
      if (q.difficulty === "سهل" || q.difficulty === "متوسط" || q.difficulty === "صعب") {
        counts[q.difficulty]++;
      }
    });
    return [
      { name: "سهل", "العدد": counts["سهل"] },
      { name: "متوسط", "العدد": counts["متوسط"] },
      { name: "صعب", "العدد": counts["صعب"] }
    ];
  }, [questions]);

  // 1. Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser((current: any) => {
        if (current && current.uid && current.uid.startsWith("local-")) {
          return current;
        }
        return firebaseUser;
      });
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Local login system to support fallback offline operations
  const handleLocalLogin = (email: string) => {
    const cleanEmail = email.trim().replace(/\s+/g, "");
    const mockUid = `local-${cleanEmail.toLowerCase().replace(/[^a-z0-9]/g, "") || "teacher"}`;
    setUser({
      uid: mockUid,
      email: cleanEmail.toUpperCase() === "INJAZ706@GMAIL.COM" ? "INJAZ706@GMAIL.COM" : cleanEmail,
      emailVerified: true
    });
    setAuthLoading(false);
  };

  const handleLocalLoginClick = () => {
    const emailToUse = authEmail.trim() || "INJAZ706@GMAIL.COM";
    handleLocalLogin(emailToUse);
  };

  // 2. Firebase Questions Real-time synchronization & Seeding
  useEffect(() => {
    if (!user) {
      setQuestions([]);
      return;
    }

    if (user.uid.startsWith("local-")) {
      // Local storage fallback
      const localKey = `qbank_local_questions_${user.uid}`;
      const localData = localStorage.getItem(localKey);
      if (localData) {
        setQuestions(JSON.parse(localData));
      } else {
        const seeded = INITIAL_QUESTIONS.map((q, idx) => ({
          ...q,
          id: `local-q-${idx}-${Date.now()}`,
          userId: user.uid,
          created_at: q.created_at || new Date().toISOString()
        }));
        localStorage.setItem(localKey, JSON.stringify(seeded));
        setQuestions(seeded);
      }
      return;
    }

    const qQuestions = query(collection(db, "questions"), where("userId", "==", user.uid));
    const unsubscribeQuestions = onSnapshot(
      qQuestions,
      async (snapshot) => {
        const list: Question[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Question);
        });

        // Sort descending by creation date
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (list.length === 0) {
          // If Firestore contains zero questions for the user, auto seed with INITIAL_QUESTIONS from seedData
          try {
            console.log("Seeding Firestore with INITIAL_QUESTIONS...");
            const batch = writeBatch(db);
            INITIAL_QUESTIONS.forEach((q) => {
              const qRef = doc(collection(db, "questions"));
              batch.set(qRef, {
                ...q,
                id: qRef.id,
                userId: user.uid,
                created_at: q.created_at || new Date().toISOString()
              });
            });
            await batch.commit();
          } catch (e) {
            console.error("Failed to seed initial questions: ", e);
          }
        } else {
          setQuestions(list);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "questions");
      }
    );

    return () => unsubscribeQuestions();
  }, [user]);

  // Auth Submit Action for Login and Signup
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setIsAuthSubmitting(true);

    const emailTrimmed = authEmail.trim();
    const passwordTrimmed = authPassword.trim();

    if (!emailTrimmed || !passwordTrimmed) {
      setAuthError("الرجاء تعبئة كلاً من البريد الإلكتروني وكلمة المرور.");
      setIsAuthSubmitting(false);
      return;
    }

    try {
      try {
        await signInWithEmailAndPassword(auth, emailTrimmed, passwordTrimmed);
      } catch (signInErr: any) {
        const normalizedEmail = emailTrimmed.toLowerCase();
        const code = signInErr.code;

        // Auto-provision demo credentials or any new teacher credentials on-the-fly
        if (code === "auth/user-not-found" || code === "auth/invalid-credential" || code === "auth/wrong-password") {
          try {
            // Attempt to create the user immediately
            const credentials = await createUserWithEmailAndPassword(auth, emailTrimmed, passwordTrimmed);
            const userRef = doc(db, "users", credentials.user.uid);
            await setDoc(userRef, {
              id: credentials.user.uid,
              email: emailTrimmed.toUpperCase() === "INJAZ706@GMAIL.COM" ? "INJAZ706@GMAIL.COM" : emailTrimmed,
              role: normalizedEmail === "admin@qbank.com" ? "admin" : "teacher",
              createdAt: new Date().toISOString()
            });
          } catch (signUpErr: any) {
            // If the user already exists, then the password entered during sign-in was wrong
            if (signUpErr.code === "auth/email-already-in-use") {
              throw new Error("كلمة المرور المدخلة غير صحيحة لهذا الحساب السحابي.");
            } else if (signUpErr.code === "auth/operation-not-allowed" || signUpErr.message?.includes("operation-not-allowed")) {
              console.warn("Firebase Auth operation-not-allowed. Falling back to local offline session.");
              handleLocalLogin(emailTrimmed);
              return;
            } else {
              throw signUpErr;
            }
          }
        } else if (code === "auth/operation-not-allowed" || signInErr.message?.includes("operation-not-allowed")) {
          console.warn("Firebase Auth operation-not-allowed. Falling back to local offline session.");
          handleLocalLogin(emailTrimmed);
          return;
        } else {
          throw signInErr;
        }
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = "فشلت عملية المصادقة. يرجى مراجعة تفاصيل الاتصال.";
      if (err.code === "auth/user-not-found") {
        errMsg = "البريد الإلكتروني هذا لوحظ كونه غير مسجل حالياً.";
      } else if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        errMsg = "كلمة المرور أو البريد الإلكتروني غير صحيحة.";
      } else if (err.code === "auth/email-already-in-use") {
         errMsg = "البريد الإلكتروني المدخل قيد العمل لدى معلم آخر.";
      } else if (err.code === "auth/weak-password") {
        errMsg = "كلمة المرور المدخلة يجب ألا تمتد بنطاق أقل من 6 خانات.";
      } else if (err.code === "auth/invalid-email") {
        errMsg = "هذا البريد الإلكتروني غير صالح من الناحية الفنية.";
      } else if (err.code === "auth/operation-not-allowed") {
        handleLocalLogin(emailTrimmed);
        return;
      } else if (err.message) {
        errMsg = err.message;
      }
      setAuthError(errMsg);
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  // Logout action
  const handleSignOut = () => {
    setConfirmConfig({
      isOpen: true,
      title: "تأكيد تسجيل الخروج وتأمين الحساب 🔐",
      message: "هل تريد بالفعل تسجيل الخروج والعودة لشاشة الدخول؟ إذا كنت في وضع العمل الاحتياطي فسيتم إغلاق الجلسة الحالية وتأمين حاسوبك.",
      confirmText: "نعم، تسجيل الخروج",
      cancelText: "البقاء في النظام",
      type: "warning",
      action: async () => {
        setConfirmConfig(null);
        if (user?.uid?.startsWith("local-")) {
          setUser(null);
        } else {
          await signOut(auth);
        }
      }
    });
  };

  // Helper subjects gathered dynamically
  const subjectsList = ["الرياضيات", "الفيزياء", "الكيمياء", "الأحياء", "العلوم العامة", "أخرى"];

  // Create or Update Question Form Submit
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formQuestionText.trim()) return;
    if (formOptions.some(opt => !opt.trim())) {
      alert("الرجاء ملء جميع التفاصيل والخيارات الأربعة للطلاب.");
      return;
    }

    if (user?.uid?.startsWith("local-")) {
      const localKey = `qbank_local_questions_${user.uid}`;
      let updatedList: Question[] = [];
      if (modalMode === "create") {
        const newId = `local-q-${Date.now()}`;
        const newQuestion: Question = {
          id: newId,
          question_text: formQuestionText,
          options: [...formOptions],
          correct_answer: formCorrectAnswer,
          subject: formSubject,
          difficulty: formDifficulty,
          created_at: new Date().toISOString()
        };
        updatedList = [{ ...newQuestion, userId: user.uid }, ...questions];
      } else {
        updatedList = questions.map(q => {
          if (q.id === editingQuestionId) {
            return {
              ...q,
              question_text: formQuestionText,
              options: [...formOptions],
              correct_answer: formCorrectAnswer,
              subject: formSubject,
              difficulty: formDifficulty
            };
          }
          return q;
        });
      }
      setQuestions(updatedList);
      localStorage.setItem(localKey, JSON.stringify(updatedList));
      setShowQuestionModal(false);
      resetForm();
      return;
    }

    if (modalMode === "create") {
      const qRef = doc(collection(db, "questions"));
      const newQuestion: Question = {
        id: qRef.id,
        question_text: formQuestionText,
        options: [...formOptions],
        correct_answer: formCorrectAnswer,
        subject: formSubject,
        difficulty: formDifficulty,
        created_at: new Date().toISOString()
      };
      
      try {
        await setDoc(qRef, {
          ...newQuestion,
          userId: user.uid
        });
        setShowQuestionModal(false);
        resetForm();
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `questions/${qRef.id}`);
      }
    } else {
      // Edit mode
      const qRef = doc(db, "questions", editingQuestionId!);
      try {
        await updateDoc(qRef, {
          question_text: formQuestionText,
          options: [...formOptions],
          correct_answer: formCorrectAnswer,
          subject: formSubject,
          difficulty: formDifficulty
        });
        setShowQuestionModal(false);
        resetForm();
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `questions/${editingQuestionId}`);
      }
    }
  };

  const resetForm = () => {
    setFormQuestionText("");
    setFormSubject("الرياضيات");
    setFormDifficulty("متوسط");
    setFormOptions(["", "", "", ""]);
    setFormCorrectAnswer("أ");
    setEditingQuestionId(null);
  };

  const handleEditQuestionClick = (q: Question) => {
    setModalMode("edit");
    setEditingQuestionId(q.id);
    setFormQuestionText(q.question_text);
    setFormSubject(q.subject);
    setFormDifficulty(q.difficulty);
    setFormOptions([...q.options]);
    setFormCorrectAnswer(q.correct_answer);
    setShowQuestionModal(true);
  };

  const handleDeleteQuestion = async (id: string) => {
    if (user?.uid?.startsWith("local-")) {
      const localKey = `qbank_local_questions_${user.uid}`;
      const updatedList = questions.filter(q => q.id !== id);
      setQuestions(updatedList);
      localStorage.setItem(localKey, JSON.stringify(updatedList));
      setDeleteConfirmId(null);
      return;
    }

    const qRef = doc(db, "questions", id);
    try {
      await deleteDoc(qRef);
      setDeleteConfirmId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `questions/${id}`);
    }
  };

  // File to Base64 OCR Helper
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setFileMimeType(file.type);
      
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = (reader.result as string).split(",")[1];
        setFileBase64(base64Data);
      };
      reader.onerror = () => {
        alert("فشل قراءة الملف المرفق.");
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger server-side Gemini generation or parsing
  const handleAiTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAiLoading(true);
    setAiStatusMessage(aiMode === "ocr" ? "جاري قراءة الملف واستخراج البيانات عبر الذكاء الاصطناعي..." : "جاري صياغة وإنتاج أسئلة اختبارية جديدة...");
    setAiApiKeyMissing(false);

    try {
      const payload: any = {
        difficulty: aiDifficulty,
        subject: aiSubject
      };

      if (aiMode === "ocr") {
        if (!fileBase64) {
          alert("الرجاء تحميل أو سحب صورة ورقة الأسئلة أو مستند الاختبار أولاً.");
          setIsAiLoading(false);
          return;
        }
        payload.fileData = fileBase64;
        payload.mimeType = fileMimeType;
        payload.prompt = aiPrompt || "استخرج الأسئلة المتوفرة في هذه الوثيقة بذكاء ورتبها مع خياراتها وتحديد الإجابة الصحيحة للكل.";
      } else {
        payload.generateCount = aiCount;
        payload.prompt = aiPrompt;
      }

      const response = await fetch("/api/gemini/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        if (data.error && data.error.includes("GEMINI_API_KEY")) {
          setAiApiKeyMissing(true);
        }
        throw new Error(data.error || "فشل الاتصال بمخدم الذكاء الاصطناعي.");
      }

      // Prepend temporary reviewer IDs to prevent collision
      const mappedQs = data.questions.map((q: any, idx: number) => ({
        ...q,
        id: `ai-temp-${Date.now()}-${idx}`,
        created_at: new Date().toISOString()
      }));

      setPreviewQuestions(mappedQs);
      setAiStatusMessage("تمت عملية التوليد بنجاح! الرجاء مراجعة الأسئلة بالأسفل ثم الموافقة على استيرادها.");
    } catch (err: any) {
      console.error(err);
      alert(err.message || "عذراً، حدث خطأ أثناء الاتصال بمزود الذكاء الاصطناعي. تأكد من تفعيل مفتاح الـ API.");
      setAiStatusMessage("فشلت المحاولة بسبب تعذر معالجة الطلب.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // Save parsed/generated AI questions to database
  const handleImportReviewedAll = async () => {
    if (previewQuestions.length === 0) return;
    
    try {
      setIsAiLoading(true);
      const batch = writeBatch(db);
      previewQuestions.forEach((q) => {
        const qRef = doc(collection(db, "questions"));
        batch.set(qRef, {
          question_text: q.question_text,
          options: [...q.options],
          correct_answer: q.correct_answer,
          subject: q.subject,
          difficulty: q.difficulty,
          created_at: new Date().toISOString(),
          userId: user.uid,
          id: qRef.id
        });
      });
      await batch.commit();
      setPreviewQuestions([]);
      alert(`تم بنجاح وبأمان استيراد وتخزين عدد ${previewQuestions.length} أسئلة جديدة في قاعدة البيانات السحابية!`);
      setActiveView("questions");
    } catch (error) {
      console.error(error);
      alert("فشل رفع الأسئلة المستوردة لقاعدة البيانات.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleEditPreviewQuestionField = (id: string, field: keyof Question, value: any) => {
    setPreviewQuestions(prev => prev.map(q => {
      if (q.id === id) {
        if (field === "options") {
          return { ...q, options: value };
        }
        return { ...q, [field]: value };
      }
      return q;
    }));
  };

  const handleRemovePreviewQuestion = (id: string) => {
    setPreviewQuestions(prev => prev.filter(q => q.id !== id));
  };

  // Exam Selection Logic
  const handleGenerateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Filter questions list matching criteria
    let candidates = questions;
    if (examSubject !== "الكل" && examSubject !== "عام") {
      candidates = candidates.filter(q => q.subject === examSubject);
    }
    if (examDifficulty !== "الكل") {
      candidates = candidates.filter(q => q.difficulty === examDifficulty);
    }

    if (candidates.length === 0) {
      alert("عذراً، لا توجد أسئلة كافية في بنك الأسئلة تطابق هذه الشروط المحددة. يرجى إضافة المزيد من الأسئلة أو تغيير خيارات التصفية.");
      return;
    }

    // Shuffle and pick
    const shuffled = [...candidates].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(examCount, shuffled.length));

    const examDocRef = doc(collection(db, "exams"));
    const newExam: Exam = {
      id: examDocRef.id,
      title: examTitle,
      subject: examSubject === "الكل" ? "امتحان عام" : examSubject,
      difficulty: examDifficulty,
      duration: examDuration,
      questions: selected,
      created_at: new Date().toISOString()
    };

    try {
      await setDoc(examDocRef, {
        ...newExam,
        userId: user.uid
      });
      setGeneratedExam(newExam);
    } catch (err) {
      console.error(err);
      // Safe fallback offline render
      setGeneratedExam(newExam);
    }
  };

  // Print trigger
  const handlePrintExam = () => {
    window.print();
  };

  // Reset to seed data
  const handleResetDatabase = () => {
    setConfirmConfig({
      isOpen: true,
      title: "إعادة تعيين بنك الأسئلة الموحد ⚠️",
      message: "تنبيه هام جداً! هل تريد حقاً إعادة ضبط البنك إلى الداتا الافتراضية؟ سيتم حذف كافة أسئلتك الحالية من قاعدة البيانات والمزامنة مع حزمة الأسئلة المتكاملة المحددة مسبقاً في النظام.",
      confirmText: "نعم، إعادة ضبط كاملة",
      cancelText: "تراجع وإلغاء",
      type: "danger",
      action: async () => {
        setConfirmConfig(null);
        try {
          setIsAiLoading(true);
          if (user?.uid?.startsWith("local-")) {
            const localKey = `qbank_local_questions_${user.uid}`;
            const seeded = INITIAL_QUESTIONS.map((q, idx) => ({
              ...q,
              id: `local-q-${idx}-${Date.now()}`,
              userId: user.uid,
              created_at: q.created_at || new Date().toISOString()
            }));
            localStorage.setItem(localKey, JSON.stringify(seeded));
            setQuestions(seeded);
            alert("تمت إعادة ضبط بنك الأسئلة المحلي الاحتياطي بنجاح.");
            return;
          }

          const snapshot = await getDocs(query(collection(db, "questions"), where("userId", "==", user.uid)));
          const batch = writeBatch(db);
          snapshot.forEach((docSnap) => {
            batch.delete(docSnap.ref);
          });
          await batch.commit();

          const seedBatch = writeBatch(db);
          INITIAL_QUESTIONS.forEach((q) => {
            const qRef = doc(collection(db, "questions"));
            seedBatch.set(qRef, {
              ...q,
              id: qRef.id,
              userId: user.uid,
              created_at: q.created_at || new Date().toISOString()
            });
          });
          await seedBatch.commit();
          alert("تمت إعادة ضبط بنك الأسئلة السحابي بنجاح.");
        } catch (err: any) {
          console.error(err);
          alert("حدث خطأ أثناء إعادة تهيئة قاعدة البيانات: " + err.message);
        } finally {
          setIsAiLoading(false);
        }
      }
    });
  };

  // Data Export as JSON
  const handleExportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(questions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `QBank_Backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Data Import from JSON file
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], "UTF-8");
      fileReader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (Array.isArray(parsed)) {
            // Simple validation
            const isValid = parsed.every(item => item.question_text && Array.isArray(item.options) && item.correct_answer);
            if (isValid) {
              setIsAiLoading(true);
              const batch = writeBatch(db);
              parsed.forEach((q) => {
                const qRef = doc(collection(db, "questions"));
                batch.set(qRef, {
                  question_text: q.question_text,
                  options: [...q.options],
                  correct_answer: q.correct_answer,
                  subject: q.subject || "العلوم العامة",
                  difficulty: q.difficulty || "متوسط",
                  created_at: q.created_at || new Date().toISOString(),
                  userId: user.uid,
                  id: qRef.id
                });
              });
              await batch.commit();
              alert(`تم بنجاح دمج ملف النسخة الاحتياطية واستيراد عدد ${parsed.length} أسئلة سحابية جديدة!`);
            } else {
              alert("تنسيق الملف الاحتياطي غير صالح. يجب أن يحتوي على قائمة أسئلة صحيحة.");
            }
          } else {
            alert("تنسيق الملف الاحتياطي غير معترف به.");
          }
        } catch (err) {
          alert("فشل تحميل ملف النسخة الاحتياطية. يرجى التأكد من اختيار ملف JSON صحيح.");
        } finally {
          setIsAiLoading(false);
        }
      };
    }
  };

  // Live filter counting
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          q.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSubject = filterSubject === "الكل" || q.subject === filterSubject;
    const matchesDifficulty = filterDifficulty === "الكل" || q.difficulty === filterDifficulty;
    return matchesSearch && matchesSubject && matchesDifficulty;
  });

  const totalPages = Math.ceil(filteredQuestions.length / itemsPerPage) || 1;
  const paginatedQuestions = filteredQuestions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center space-y-4" style={{ direction: "rtl" }}>
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-xs font-bold text-slate-505 font-sans">برجاء الانتظار، جاري تشغيل بيئة الاتصال وتأمين البوابات السحابية...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4 sm:p-6" style={{ direction: "rtl" }}>
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl shadow-slate-200/40"
        >
          {/* Brand Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
              <Database className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-black text-slate-900 font-sans tracking-tight">منظومة Q-Bank Pro الذكية 🔐</h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
              مرحباً بك في المنصة السحابية لبنك الأسئلة وهندسة الامتحانات المدرسية المنسقة باللغة العربية.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authError && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3.5 rounded-xl flex items-center gap-2.5 text-right w-full"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{authError}</span>
              </motion.div>
            )}

            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-slate-600 block">البريد الإلكتروني للمعلم 📧</label>
              <input
                type="email"
                placeholder="example@domain.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full text-right bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-blue-500 text-slate-800 placeholder-slate-400"
              />
            </div>

            <div className="space-y-1.5 text-right">
              <label className="text-xs font-bold text-slate-600 block">كلمة المرور السرية 🔒</label>
              <input
                type="password"
                placeholder="كلمة المرور الخاصة بك"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full text-right bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-blue-500 text-slate-800 placeholder-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={isAuthSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-black py-3.5 rounded-xl cursor-pointer transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-2"
            >
              {isAuthSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري المزامنة السحابية...</span>
                </>
              ) : (
                <span>تسجيل الدخول الآمن 🚀</span>
              )}
            </button>

            <div className="relative flex items-center justify-center py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-100"></span>
              </div>
              <span className="relative px-3 text-[10px] font-bold text-slate-400 bg-white">أو تجاوز مشاكل الاتصال</span>
            </div>

            <button
              type="button"
              onClick={handleLocalLoginClick}
              className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold py-3 px-4 rounded-xl cursor-pointer transition-all border border-slate-200/60 flex items-center justify-center gap-2"
            >
              <span>الدخول في الوضع المحلي الاحتياطي 🔓</span>
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc] text-[#1e293b] select-none text-right placeholder-right" style={{ direction: "rtl" }}>
      
      {/* SIDEBAR MAIN MENU (Hidden during system print window) */}
      <aside className="w-full md:w-64 bg-[#f5f5f7] text-slate-800 shrink-0 no-print flex flex-col z-10 border-l border-slate-200">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 font-sans">Q-Bank Pro</h1>
              <p className="text-[10px] text-slate-500 font-mono tracking-wider">كيو بانك برو v2.5</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <button 
            id="nav-btn-qbank"
            onClick={() => { setActiveView("questions"); setCurrentPage(1); }}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeView === "questions" 
                ? "bg-blue-600 text-white shadow-md font-semibold" 
                : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
          >
            <BookOpen className="w-5 h-5 shrink-0" />
            <span>بنك الأسئلة الرئيسي</span>
            <span className={`mr-auto text-xs px-2 py-0.5 rounded-full font-mono ${
              activeView === "questions" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
            }`}>
              {questions.length}
            </span>
          </button>

          <button 
            id="nav-btn-ai-importer"
            onClick={() => setActiveView("import")}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeView === "import" 
                ? "bg-blue-600 text-white shadow-md font-semibold" 
                : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
          >
            <FileType className={`w-5 h-5 shrink-0 ${activeView === "import" ? "text-white" : "text-blue-600"}`} />
            <span>الاستيراد والتوليد الذكي</span>
            <span className={`mr-auto text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
              activeView === "import" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-600"
            }`}>AI</span>
          </button>

          <button 
            id="nav-btn-exam-maker"
            onClick={() => {
              setActiveView("generate");
              if (!generatedExam && questions.length > 0) {
                // Pre-generate a basic preview
                const rand = [...questions].sort(() => 0.5 - Math.random()).slice(0, 5);
                setGeneratedExam({
                  id: "initial-preview",
                  title: examTitle,
                  subject: "الرياضيات",
                  difficulty: "متوسط",
                  duration: examDuration,
                  questions: rand,
                  created_at: new Date().toISOString()
                });
              }
            }}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeView === "generate" 
                ? "bg-blue-600 text-white shadow-md font-semibold" 
                : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
          >
            <FileText className="w-5 h-5 shrink-0" />
            <span>صانع ومصدر الامتحانات</span>
          </button>

          <button 
            id="nav-btn-settings"
            onClick={() => setActiveView("settings")}
            className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeView === "settings" 
                ? "bg-blue-600 text-white shadow-md font-semibold" 
                : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            }`}
          >
            <SettingsIcon className="w-5 h-5 shrink-0" />
            <span>خيارات النسخ والضبط</span>
          </button>

          {user?.email === "admin@qbank.com" && (
            <button 
              id="nav-btn-admin-panel"
              onClick={() => setActiveView("admin")}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeView === "admin" 
                  ? "bg-indigo-600 text-white shadow-md font-semibold font-sans animate-pulse" 
                  : "text-indigo-600 hover:bg-indigo-50 border border-indigo-100 bg-white/70"
              }`}
            >
              <Award className="w-5 h-5 shrink-0 text-indigo-505" />
              <span>لوحة الإدارة والمشرف</span>
            </button>
          )}
        </nav>

        {/* User Card & Sign Out */}
        {user && (
          <div className={`p-4 mx-4 mb-3 rounded-2xl border flex flex-col gap-2.5 text-right transition-colors ${
            user.email === "admin@qbank.com" 
              ? "bg-indigo-50/80 border-indigo-200" 
              : "bg-[#eaebef] border-slate-200/65"
          }`}>
            <div className="flex items-center gap-2.5 justify-start">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-[11px] font-black shrink-0 ${
                user.email === "admin@qbank.com" ? "bg-indigo-600" : "bg-blue-600"
              }`}>
                {user.email ? user.email.slice(0, 2).toUpperCase() : "TE"}
              </div>
              <div className="overflow-hidden">
                <p className="text-[11px] font-extrabold text-slate-800 truncate leading-tight">
                  {user.email === "admin@qbank.com" ? "حساب المدير 👑" : "حساب المعلم 🧑‍🏫"}
                </p>
                <p className="text-[9px] text-slate-500 truncate leading-none mt-0.5" title={user.email}>{user.email}</p>
              </div>
            </div>
            
            <button
              onClick={handleSignOut}
              className="mt-0.5 w-full bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 text-[10px] font-extrabold py-2 px-3 rounded-xl border border-red-200/50 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <span>تسجيل الخروج الآمن 🚪</span>
            </button>
          </div>
        )}

        <div className="p-4 border-t border-slate-200 text-center text-[11px] text-slate-500">
          <p>تم التطوير بامتثال كامل للأكاديمية التعليمية الموحدة</p>
          <p className="mt-1 text-[10px]">العربية أولاً RTL</p>
        </div>
      </aside>

      {/* WORKSPACE AREA */}
      <main className="flex-1 flex flex-col overflow-y-auto w-full">
        
        {/* HEADER BAR (Hidden during printing) */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 shrink-0 no-print flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-400">منظومة إعداد الأسئلة ✦</span>
            <span className="text-sm font-bold text-slate-800">
              {activeView === "questions" && "بنك الأسئلة الأكاديمية"}
              {activeView === "import" && "شاشة المساعد الذكي الاصطناعي"}
              {activeView === "generate" && "لوحة صياغة وهندسة الامتحانات المدرسية"}
              {activeView === "settings" && "إدارة قواعد البيانات والنسخ الاحتياطي"}
              {activeView === "admin" && "لوحة التحكم والمدير الشاملة 👑"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg text-slate-600 text-xs transition-all border border-slate-200">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              <span>التوقيت: {new Date().toLocaleDateString("ar-EG")}</span>
            </div>
            
            {activeView === "questions" && (
              <button 
                id="btn-trigger-add-modal"
                onClick={() => { setModalMode("create"); resetForm(); setShowQuestionModal(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة سؤال يدوياً</span>
              </button>
            )}
          </div>
        </header>

        {/* WORKSPACE PAGES PANEL */}
        <section className="flex-1 p-6 print-container" id="main-scrollable-workspace">
          {user?.uid?.startsWith("local-") && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold p-3 rounded-xl flex items-center justify-between gap-3 no-print"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-amber-500 rounded-full shrink-0"></span>
                <span>أنت تستخدم المنصة الآن في الوضع المحلي الاحتياطي لحساب <strong>{user.email}</strong>. كافة المميزات تحفظ في متصفحك الحالي وهي تدعم الصياغة وإعداد الامتحانات والـ OCR بالكامل!</span>
              </div>
              <button 
                onClick={handleSignOut} 
                className="text-amber-900 border border-amber-300 hover:bg-amber-100 bg-white/50 px-2.5 py-1 rounded-lg text-[10px] transition cursor-pointer font-extrabold"
              >
                تبديل الحساب
              </button>
            </motion.div>
          )}
          <AnimatePresence mode="wait">
            
            {/* VIEW A: QUESTIONS LIST (BANK) */}
            {activeView === "questions" && (
              <motion.div 
                key="questions-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 no-print"
              >
                {/* Search & Statistics Banner */}
                <div className="bg-slate-100 border border-slate-200 text-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-2">
                    <h2 className="text-xl font-extrabold text-slate-900 font-sans">مستودع الأسئلة المتكامل</h2>
                    <p className="text-xs text-slate-500 max-w-xl">
                      هنا يجري فرز وتنظيم الأسئلة وفلترتها بحسب التخصص التربوي أو مدى صعوبة المنهج. انقر فوق زر الإضافة لتوسيع بنك الأسئلة أو انتقل إلى شاشة الاستيراد الذكية لتحميل ملفات PDF وصور الأسئلة.
                    </p>
                  </div>
                  <div className="flex gap-4 shrink-0 bg-white p-4 rounded-xl border border-slate-200 shadow-sm font-mono text-center">
                    <div>
                      <span className="block text-2xl font-extrabold text-blue-600">{questions.length}</span>
                      <span className="text-[10px] text-slate-500">إجمالي الأسئلة</span>
                    </div>
                    <div className="border-r border-slate-200 pr-4">
                      <span className="block text-2xl font-extrabold text-emerald-600">
                        {questions.filter(q => q.difficulty === "سهل").length}
                      </span>
                      <span className="text-[10px] text-slate-500">سهل</span>
                    </div>
                    <div className="border-r border-slate-200 pr-4">
                      <span className="block text-2xl font-extrabold text-blue-500">
                        {questions.filter(q => q.difficulty === "متوسط").length}
                      </span>
                      <span className="text-[10px] text-slate-500">متوسط</span>
                    </div>
                    <div className="border-r border-slate-200 pr-4">
                      <span className="block text-2xl font-extrabold text-rose-600">
                        {questions.filter(q => q.difficulty === "صعب").length}
                      </span>
                      <span className="text-[10px] text-slate-500">صعب</span>
                    </div>
                  </div>
                </div>
                
                {/* 📊 MINI INTERACTIVE ANALYTICS DASHBOARD */}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md shadow-slate-100 overflow-hidden no-print">
                  {/* Dashboard Header with Collapse Button */}
                  <div className="bg-slate-50/60 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <Database className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <h3 className="text-sm font-bold text-slate-800 font-sans">لوحة قياس وتحليل بنك الأسئلة 📊</h3>
                        <p className="text-[10px] text-slate-400">إحصائيات فورية حول تغطية المواد التدريسية وتدرج الصعوبة</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDashboard(!showDashboard)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200/80 text-[10px] font-bold text-slate-600 rounded-lg transition-all cursor-pointer"
                    >
                      {showDashboard ? "إخفاء الرسوم البيانية ▲" : "عرض التحليل البياني ▼"}
                    </button>
                  </div>

                  {showDashboard && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6"
                    >
                      {/* Pie Chart Widget: Subject Coverage */}
                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between space-y-4">
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-700 block">توزيع الأسئلة حسب المواد والمناهج</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">مستويات التغطية للتخصصات التعليمية المختلفة</span>
                        </div>

                        {subjectData.length > 0 ? (
                          <div className="h-60 relative flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={subjectData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={4}
                                  dataKey="value"
                                >
                                  {subjectData.map((entry, index) => {
                                    const colors = ["#3b82f6", "#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#14b8a6"];
                                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                  })}
                                </Pie>
                                <ChartTooltip 
                                  contentStyle={{ 
                                    direction: "rtl", 
                                    backgroundColor: "#ffffff", 
                                    borderRadius: "12px", 
                                    border: "1px solid #e2e8f0", 
                                    fontSize: "11px", 
                                    fontWeight: "bold",
                                    color: "#1e293b"
                                  }}
                                  formatter={(value: any, name: any) => [`${value} سؤال`, name]} 
                                />
                                <ChartLegend 
                                  layout="horizontal" 
                                  verticalAlign="bottom" 
                                  align="center"
                                  iconType="circle"
                                  iconSize={8}
                                  wrapperStyle={{ fontSize: "10px", fontWeight: "bold", direction: "rtl", paddingTop: "12px" }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="h-60 flex items-center justify-center text-slate-400 text-xs">لا تتوفر معطيات كافية لتوليد الهيكل الدائري</div>
                        )}
                      </div>

                      {/* Bar Chart Widget: Difficulty Breakdown */}
                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between space-y-4">
                        <div className="text-right">
                          <span className="text-xs font-bold text-slate-700 block">منحنى توزيع مستويات الصعوبة</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">توافق الأسئلة مع تصنيفات السلم التربوي الثلاثي</span>
                        </div>

                        {questions.length > 0 ? (
                          <div className="h-60 relative flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={difficultyData} barSize={40} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis 
                                  dataKey="name" 
                                  stroke="#94a3b8" 
                                  fontSize={10} 
                                  fontWeight="bold" 
                                  tickLine={false} 
                                  axisLine={false}
                                />
                                <YAxis 
                                  stroke="#94a3b8" 
                                  fontSize={10} 
                                  fontWeight="bold" 
                                  tickLine={false} 
                                  axisLine={false}
                                />
                                <ChartTooltip 
                                  contentStyle={{ 
                                    direction: "rtl", 
                                    backgroundColor: "#ffffff", 
                                    borderRadius: "12px", 
                                    border: "1px solid #e2e8f0", 
                                    fontSize: "11px", 
                                    fontWeight: "bold",
                                    color: "#1e293b"
                                  }}
                                  cursor={{ fill: '#f8fafc' }}
                                  formatter={(value: any) => [`${value} سؤال`, "الكمية"]}
                                />
                                <Bar dataKey="العدد" radius={[8, 8, 0, 0]}>
                                  {difficultyData.map((entry, index) => {
                                    const colorsMap: Record<string, string> = {
                                      "سهل": "#10b981",
                                      "متوسط": "#3b82f6",
                                      "صعب": "#f43f5e"
                                    };
                                    return <Cell key={`cell-${index}`} fill={colorsMap[entry.name] || "#6366f1"} />;
                                  })}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="h-60 flex items-center justify-center text-slate-400 text-xs">لا توجد أسئلة كافية لرسخ المنحنيات البيانية</div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Filters Grid Row */}
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                  {/* Search Bar */}
                  <div className="relative w-full md:w-80">
                    <input 
                      id="input-q-search"
                      type="text"
                      placeholder="ابحث بالنص أو المادة التعليمية..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-right"
                    />
                    <Search className="absolute right-3.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
                  </div>

                  {/* Dropdown controls */}
                  <div className="flex flex-wrap gap-3 items-center w-full md:w-auto justify-end">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-semibold text-slate-500">التخصص:</label>
                      <select
                        id="select-filter-subject"
                        value={filterSubject}
                        onChange={(e) => { setFilterSubject(e.target.value); setCurrentPage(1); }}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                      >
                        <option value="الكل">كل التخصصات والمواد ({questions.length})</option>
                        {subjectsList.map(sub => (
                          <option key={sub} value={sub}>{sub} ({questions.filter(q => q.subject === sub).length})</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-semibold text-slate-500">الصعوبة:</label>
                      <select
                        id="select-filter-difficulty"
                        value={filterDifficulty}
                        onChange={(e) => { setFilterDifficulty(e.target.value); setCurrentPage(1); }}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                      >
                        <option value="الكل">كل درجات الصعوبة</option>
                        <option value="سهل">سهل</option>
                        <option value="متوسط">متوسط</option>
                        <option value="صعب">صعب</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Table Data list of questions */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right" id="table-question-bank">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          <th className="px-6 py-4 w-16">م</th>
                          <th className="px-6 py-4 w-32">المادة</th>
                          <th className="px-6 py-4 w-24">مستوى الصعوبة</th>
                          <th className="px-6 py-4">محتوى ونص السؤال الأكاديمي</th>
                          <th className="px-6 py-4 w-28">الجواب الصحيح</th>
                          <th className="px-6 py-4 w-24 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {paginatedQuestions.length > 0 ? (
                          paginatedQuestions.map((q, index) => {
                            const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                            return (
                              <tr key={q.id} className="hover:bg-slate-50/80 transition-all group">
                                <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-400 font-semibold">{globalIndex}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700">
                                    {q.subject}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                    q.difficulty === "سهل" 
                                      ? "bg-emerald-50 text-emerald-700" 
                                      : q.difficulty === "متوسط" 
                                      ? "bg-blue-50 text-blue-700" 
                                      : "bg-rose-50 text-rose-700"
                                  }`}>
                                    {q.difficulty}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="font-semibold text-slate-800 break-words max-w-2xl text-[14px]">
                                    {q.question_text}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-slate-500">
                                    {q.options && q.options.map((opt, oIdx) => (
                                      <div key={oIdx} className="bg-slate-50 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 border border-slate-100">
                                        <span className="font-bold text-blue-600">
                                          {oIdx === 0 ? "أ)" : oIdx === 1 ? "ب)" : oIdx === 2 ? "ج)" : "د)"}
                                        </span>
                                        <span>{opt}</span>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-100">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>الخيار ({q.correct_answer})</span>
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      id={`btn-edit-q-${q.id}`}
                                      title="تعديل هذا السؤال"
                                      onClick={() => handleEditQuestionClick(q)}
                                      className="p-1 px-2.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-all cursor-pointer"
                                    >
                                      <Edit3 className="w-4 h-4" />
                                    </button>
                                    <button
                                      id={`btn-delete-q-${q.id}`}
                                      title="حذف هذا السؤال"
                                      onClick={() => setDeleteConfirmId(q.id)}
                                      className="p-1 px-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg transition-all cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="text-center py-12 text-slate-400">
                              <AlertCircle className="w-8 h-8 mx-auto mb-3.5 text-slate-300" />
                              <p className="text-sm">لا تتوفر أي أسئلة مطابقة للتصفية الحالية.</p>
                              <p className="text-xs mt-1 text-slate-300">أضف أسئلة جديدة أو اضغط على خيارات النسخ لإعادة الضبط.</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Footer with Pagination */}
                  <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-semibold">
                      عرض {Math.min(filteredQuestions.length, itemsPerPage)} أسئلة من أصل {filteredQuestions.length} عنصر مفهرس
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                      >
                        السابق
                      </button>
                      <span className="px-4 text-xs font-mono font-bold text-slate-600">
                        صفحة {currentPage} من {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
                      >
                        التالي
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* VIEW B: AI SMART INGESTER & GENERATOR */}
            {activeView === "import" && (
              <motion.div 
                key="import-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 no-print"
              >
                {/* Banner introducing the AI capabilities */}
                <div className="bg-blue-50 border border-blue-100 text-slate-850 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1 px-2.5 bg-blue-600 text-white text-xs font-bold rounded-full uppercase tracking-wider">الاستيراد الذكي</span>
                      <span className="text-xs text-blue-600 font-semibold">• مدعوم بنموذج Gemini 3.5-flash الأحدث</span>
                    </div>
                    <h2 className="text-2xl font-extrabold font-sans text-slate-900">المساعد الذكي لتوليد واستخراج الأسئلة</h2>
                    <p className="text-xs text-slate-600 max-w-xl">
                      اختر طريقة التوليد المفضلة لديك: إما عن طريق تصوير/تحميل مستند PDF لتعليمات الأسئلة ليقوم النظام بقراءتها تلقائياً (OCR)، أو عبر كتابة فكرة موضوع وسيقوم نظام الذكاء الاصطناعي بصياغة الأسئلة آلياً طبقاً للمواصفات!
                    </p>
                  </div>
                  <BookOpen className="w-12 h-12 text-blue-600 shrink-0" />
                </div>

                {/* API Key Missing warning */}
                {aiApiKeyMissing && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-rose-800">تنبيه: مفتاح الـ API للذكاء الاصطناعي غير مدخل</h4>
                      <p className="text-xs text-rose-600 mt-1">
                        الرجاء تهيئة مفتاح بيئة العمل <code className="font-mono bg-rose-100 px-1 py-0.5 rounded text-rose-700">GEMINI_API_KEY</code> في لوحة <b>Settings &gt; Secrets</b> بالمنصة لتتمكن من إتمام الاستيراد المباشر.
                      </p>
                    </div>
                  </div>
                )}

                {/* Dual Mode Switch Tabs */}
                <div className="flex border-b border-slate-200">
                  <button 
                    id="ai-mode-ocr-tab"
                    onClick={() => { setAiMode("ocr"); setPreviewQuestions([]); }}
                    className={`px-6 py-3.5 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
                      aiMode === "ocr" 
                        ? "border-blue-600 text-blue-600 font-extrabold" 
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>الاستخراج الذكي من ملف (OCR)</span>
                  </button>
                  <button 
                    id="ai-mode-generate-tab"
                    onClick={() => { setAiMode("generate"); setPreviewQuestions([]); }}
                    className={`px-6 py-3.5 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
                      aiMode === "generate" 
                        ? "border-blue-600 text-blue-600 font-extrabold" 
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <RefreshCw className="w-4 h-4 text-blue-500" />
                    <span>توليد أسئلة جديدة كلياً بالذكاء الاصطناعي</span>
                  </button>
                </div>

                {/* Primary controls form */}
                <form onSubmit={handleAiTrigger} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Mode Specific Inputs */}
                    {aiMode === "ocr" ? (
                      <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700">قم بسحب وإفلات صورة الامتحان أو المستند المرفق:</label>
                        <div className="relative border-2 border-dashed border-slate-300 rounded-2xl p-6 hover:border-indigo-500 hover:bg-indigo-50/20 transition-all flex flex-col items-center justify-center text-center group cursor-pointer">
                          <input 
                            id="ai-ocr-file-input"
                            type="file" 
                            accept="image/*, application/pdf"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                          <div className="p-4 bg-slate-50 rounded-full group-hover:scale-110 transition-transform">
                            <FileType className="w-8 h-8 text-indigo-500" />
                          </div>
                          {selectedFile ? (
                            <div className="mt-4">
                              <span className="block text-sm font-bold text-indigo-600">{selectedFile.name}</span>
                              <span className="text-xs text-slate-400 font-mono">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type || "مستند"}</span>
                            </div>
                          ) : (
                            <div className="mt-4 space-y-1">
                              <span className="block text-sm font-semibold text-slate-700">اضغط هنا أو اسحب الملف لرفعه مباشرةً</span>
                              <span className="block text-xs text-slate-400">يدعم الصور (PNG, JPG) وكذلك مستندات PDF المدرسية</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Generation parameters inputs */
                      <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700">معايير توليد الأسئلة:</label>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">المادة المستهدفة:</label>
                            <select
                              value={aiSubject}
                              onChange={(e) => setAiSubject(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                            >
                              {subjectsList.map(sub => (
                                <option key={sub} value={sub}>{sub}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">مستوى الصعوبة:</label>
                            <select
                              value={aiDifficulty}
                              onChange={(e) => setAiDifficulty(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                            >
                              <option value="سهل">سهل</option>
                              <option value="متوسط">متوسط</option>
                              <option value="صعب">صعب</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1">عدد الأسئلة المطلوب صياغتها:</label>
                          <div className="flex items-center gap-3">
                            <input 
                              type="range" 
                              min="1" 
                              max="15" 
                              value={aiCount}
                              onChange={(e) => setAiCount(parseInt(e.target.value))}
                              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <span className="text-sm font-bold text-blue-600 shrink-0 bg-blue-50 px-3 py-1 rounded-full">{aiCount} أسئلة</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Shared Prompt Instruction override */}
                    <div className="space-y-3 flex flex-col justify-end">
                      <label className="block text-sm font-bold text-slate-700">
                        {aiMode === "ocr" ? "تعليمات وتوجيهات إضافية للفرز (اختياري):" : "صف فكرة الدرس أو الفصل التعليمي بالتحديد لإنتاج أسئلة دقيقة منه (مثال: الجبر الخطي، المعادلات التربيعية):"}
                      </label>
                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder={aiMode === "ocr" ? "مثال: استخرج المشتقات والمسائل فقط، تخطى المسائل الإملائية..." : "اكتب هنا تفاصيل المفهوم العلمي، مثلاً: 'قوانين الحركة لنيوتن ومسائل حساب السرعة والتسارع'..."}
                        rows={4}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-right resize-none flex-1 placeholder-slate-400"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      id="btn-ai-submit"
                      type="submit"
                      disabled={isAiLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-3 rounded-xl flex items-center gap-2.5 transition-all shadow-sm disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                    >
                      {isAiLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>يرجى الانتظار، جاري المعالجة...</span>
                        </>
                      ) : (
                        <>
                          <BookOpen className="w-4 h-4 text-white" />
                          <span>ابدأ التحليل والتوليد بالذكاء الاصطناعي 🚀</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Progress message state */}
                {aiStatusMessage && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs font-semibold text-blue-800 text-center flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                    <span>{aiStatusMessage}</span>
                  </div>
                )}

                {/* PREVIEW REVIEW TABLE FOR AI QUESTIONS */}
                {previewQuestions.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-800">الأسئلة المستخرجة والمولدة (بانتظار المراجعة والاعتماد)</h3>
                        <p className="text-xs text-slate-400">يمكنك تعديل أي سؤال، ضبط الخيارات، وحذف الأسئلة الضعيفة قبل حفظها رسمياً في بنك الأسئلة.</p>
                      </div>
                      <button
                        onClick={handleImportReviewedAll}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-5 py-2.5 rounded-xl flex items-center gap-2.5 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>اعتماد وحفظ جميع الأسئلة ({previewQuestions.length})</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {previewQuestions.map((q, qIdx) => (
                        <div key={q.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative group space-y-4">
                          
                          {/* Top badge indicators on preview card */}
                          <div className="flex flex-wrap items-center gap-3 justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-slate-400">السؤال #{qIdx + 1}</span>
                              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-600">{q.subject}</span>
                              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-600">{q.difficulty}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemovePreviewQuestion(q.id)}
                              className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-all"
                              title="استبعاد هذا السؤال"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Editable Question Text field */}
                          <div className="space-y-1">
                            <label className="block text-xs font-bold text-slate-500">نص السؤال الأكاديمي:</label>
                            <input 
                              type="text"
                              value={q.question_text}
                              onChange={(e) => handleEditPreviewQuestionField(q.id, "question_text", e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 font-semibold"
                            />
                          </div>

                          {/* Options grid editable */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {q.options.map((opt, oIdx) => (
                              <div key={oIdx} className="space-y-1">
                                <label className="block text-xs font-semibold text-slate-400">
                                  الخيار {oIdx === 0 ? "أ" : oIdx === 1 ? "ب" : oIdx === 2 ? "ج" : "د"}:
                                </label>
                                <input 
                                  type="text"
                                  value={opt}
                                  onChange={(e) => {
                                    const nextOpts = [...q.options];
                                    nextOpts[oIdx] = e.target.value;
                                    handleEditPreviewQuestionField(q.id, "options", nextOpts);
                                  }}
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white text-slate-700"
                                />
                              </div>
                            ))}
                          </div>

                          {/* Correct option selector */}
                          <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-500">الخيار الصحيح المعتمد للإجابة:</span>
                              <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden">
                                {["أ", "ب", "ج", "د"].map((ltr) => (
                                  <button
                                    key={ltr}
                                    type="button"
                                    onClick={() => handleEditPreviewQuestionField(q.id, "correct_answer", ltr)}
                                    className={`px-3.5 py-1 text-xs font-bold border-l border-slate-100 last:border-0 transition-all ${
                                      q.correct_answer === ltr 
                                        ? "bg-blue-600 text-white" 
                                        : "text-slate-600 hover:bg-slate-100"
                                    }`}
                                  >
                                    {ltr}
                                  </button>
                                ))}
                              </div>
                            </div>
                            
                            {/* Fast classification overrides */}
                            <div className="flex items-center gap-3">
                              <select
                                value={q.subject}
                                onChange={(e) => handleEditPreviewQuestionField(q.id, "subject", e.target.value)}
                                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-500 outline-none"
                              >
                                {subjectsList.map(sub => (
                                  <option key={sub} value={sub}>{sub}</option>
                                ))}
                              </select>
                              <select
                                value={q.difficulty}
                                onChange={(e) => handleEditPreviewQuestionField(q.id, "difficulty", e.target.value)}
                                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-500 outline-none"
                              >
                                <option value="سهل">سهل</option>
                                <option value="متوسط">متوسط</option>
                                <option value="صعب">صعب</option>
                              </select>
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>

                    <div className="pt-4 flex items-center justify-end">
                      <button
                        onClick={handleImportReviewedAll}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-8 py-3 rounded-xl flex items-center gap-2.5 transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                      >
                        <Check className="w-5 h-5" />
                        <span>اعتماد المراجعة وحفظ الأسئلة للبنك ({previewQuestions.length})</span>
                      </button>
                    </div>
                  </div>
                )}

              </motion.div>
            )}

            {/* VIEW C: EXAM GENERATOR & EXPORT PAPER */}
            {activeView === "generate" && (
              <motion.div 
                key="generate-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Exam Settings Toolbar Box (Hidden during print) */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 no-print">
                  <h2 className="text-base font-bold text-slate-800">خيارات إنشاء ورقة امتحان مدرسية رسمية</h2>
                  
                  <form onSubmit={handleGenerateExam} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">عنوان ورقة الامتحان الرئيسي:</label>
                      <input 
                        type="text" 
                        value={examTitle}
                        onChange={(e) => setExamTitle(e.target.value)}
                        placeholder="مثال: امتحان المادة النهائي للفصل الدراسي الأول..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-right"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">المادة الدراسية المستهدفة:</label>
                      <select 
                        value={examSubject}
                        onChange={(e) => setExamSubject(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="الكل">امتحان عام مشكل (كل المواد)</option>
                        {subjectsList.map(sub => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">تحديد مستوى الصعوبة:</label>
                      <select 
                        value={examDifficulty}
                        onChange={(e) => setExamDifficulty(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="الكل">مزيج عشوائي (كل الصعوبات)</option>
                        <option value="سهل">سهل</option>
                        <option value="متوسط">متوسط</option>
                        <option value="صعب">صعب</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">عدد أسئلة الامتحان:</label>
                      <div className="flex gap-1.5">
                        <input 
                          type="number"
                          min={1}
                          max={100}
                          value={examCount}
                          onChange={(e) => setExamCount(Math.min(100, Math.max(1, parseInt(e.target.value) || 1)))}
                          className="w-16 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-center text-xs font-extrabold outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-800"
                        />
                        <div className="flex-1 grid grid-cols-5 gap-1">
                          {[3, 5, 8, 10, 15].map((num) => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setExamCount(num)}
                              className={`py-2 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                                examCount === num 
                                  ? "bg-blue-600 text-white shadow-sm font-black scale-105" 
                                  : "bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {num}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">زمن ومقدار الإجابة المقدر:</label>
                      <input 
                        type="text" 
                        value={examDuration}
                        onChange={(e) => setExamDuration(e.target.value)}
                        placeholder="مثال: ساعة ونصف (90 دقيقة)..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-right"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">حجم خط ورقة الامتحان:</label>
                      <select 
                        value={examFontSize}
                        onChange={(e) => setExamFontSize(e.target.value as "sm" | "md" | "lg" | "xl")}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="sm">صغير (A4 مضغوط)</option>
                        <option value="md">متوسط (افتراضي متوازن)</option>
                        <option value="lg">كبير (مريح للقراءة)</option>
                        <option value="xl">كبير جداً (لطلاب المراحل الأولى/ضعاف النظر)</option>
                      </select>
                    </div>

                    <div className="md:col-span-3 flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        <input
                          id="checkbox-show-model-answers"
                          type="checkbox"
                          checked={showModelAnswers}
                          onChange={(e) => setShowModelAnswers(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 accent-blue-600"
                        />
                        <label htmlFor="checkbox-show-model-answers" className="text-xs font-bold text-slate-600 cursor-pointer select-none">تضمين نموذج الإجابة للمدرسين</label>
                      </div>

                      <button
                        id="btn-re-generate-exam"
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shrink-0 w-full sm:w-auto"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>توليد وتحديث الاختبار 🎲</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Print and Export CTA Row */}
                {generatedExam && (
                  <div className="space-y-4 no-print">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-100 p-4 rounded-xl border border-slate-200">
                      <span className="text-xs text-slate-600 text-center sm:text-right">
                        قامت المنظومة باختيار <b>{generatedExam.questions.length} أسئلة</b> ممتازة للامتحان بنجاح. جاهز للتصدير أو المراجعة.
                      </span>
                      <button
                        id="btn-do-print"
                        onClick={handlePrintExam}
                        className="bg-slate-900 hover:bg-black text-white text-xs font-bold px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-md hover:scale-105 transition-all cursor-pointer w-full sm:w-auto justify-center"
                      >
                        <Printer className="w-4 h-4 text-blue-400" />
                        <span>طباعة أو تصدير بصيغة PDF 📄</span>
                      </button>
                    </div>

                    {/* Logo Control Gallery Panel */}
                    <div className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl space-y-4 text-right" style={{ direction: "rtl" }}>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
                        <div>
                          <h4 className="text-xs font-black text-slate-800">تخصيص شعار الامتحان والترويسة 🎨</h4>
                          <p className="text-[10px] text-slate-500 font-bold mt-0.5">اختر شعاراً جاهزاً من معرض الأنماط الرسمية أو ارفع شعار مخصص لورقة الامتحان</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] font-sans font-extrabold px-3 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm">
                            <Upload className="w-3.5 h-3.5 text-blue-600" />
                            <span>رفع شعار من المعرض 🖼️</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setCustomLogoUrl(reader.result as string);
                                    setSelectedLogoType("custom");
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden" 
                            />
                          </label>
                          {customLogoUrl && (
                            <button
                              type="button"
                              onClick={() => {
                                setCustomLogoUrl(null);
                                setSelectedLogoType("syria");
                              }}
                              className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-[10px] font-extrabold px-3 py-2 rounded-xl transition cursor-pointer"
                            >
                              حذف المخصص 🗑_
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setSelectedLogoType("syria")}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center cursor-pointer ${
                            selectedLogoType === "syria" 
                              ? "bg-slate-900 border-slate-900 text-white font-extrabold" 
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-600 font-bold"
                          }`}
                        >
                          <svg viewBox="0 0 64 64" className="w-7 h-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M32 4 C40 8, 48 6, 52 14 C56 22, 54 30, 48 38 C42 46, 32 58, 32 58 C32 58, 22 46, 16 38 C10 30, 8 22, 12 14 C16 6, 24 8, 32 4 Z" />
                            <path d="M32 16 L32 36" />
                            <path d="M24 24 L40 24" />
                            <circle cx="32" cy="24" r="1.5" fill="currentColor" />
                          </svg>
                          <span className="text-[10px]">النسر العربي السوري</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedLogoType("education")}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center cursor-pointer ${
                            selectedLogoType === "education" 
                              ? "bg-slate-900 border-slate-900 text-white font-extrabold" 
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-600 font-bold"
                          }`}
                        >
                          <svg viewBox="0 0 24 24" className="w-7 h-7 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                            <path d="M12 3v4" />
                            <circle cx="12" cy="3" r="1" fill="currentColor" />
                          </svg>
                          <span className="text-[10px]">شعار التربية والتعليم</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedLogoType("school")}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center cursor-pointer ${
                            selectedLogoType === "school" 
                              ? "bg-slate-900 border-slate-900 text-white font-extrabold" 
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-600 font-bold"
                          }`}
                        >
                          <Award className="w-7 h-7 shrink-0" />
                          <span className="text-[10px]">درع التميز والمدرسة</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedLogoType("default")}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center cursor-pointer ${
                            selectedLogoType === "default" 
                              ? "bg-slate-900 border-slate-900 text-white font-extrabold" 
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-600 font-bold"
                          }`}
                        >
                          <div className={`w-6 h-6 border rounded rotate-45 flex items-center justify-center font-bold font-mono text-[7px] shrink-0 ${
                            selectedLogoType === "default" ? "border-white" : "border-slate-400"
                          }`}>
                            حقوق
                          </div>
                          <span className="text-[10px]">خاتم الحقوق التقليدي</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (customLogoUrl) {
                              setSelectedLogoType("custom");
                            } else {
                              alert("يرجى الضغط على زر 'رفع شعار من المعرض' أولاً لاختيار صورة شعارك المفضل.");
                            }
                          }}
                          className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center cursor-pointer ${
                            selectedLogoType === "custom" 
                              ? "bg-slate-900 border-slate-900 text-white font-extrabold" 
                              : "bg-white border-slate-200 hover:border-slate-300 text-slate-600 font-bold"
                          } ${!customLogoUrl ? "opacity-40" : ""}`}
                        >
                          {customLogoUrl ? (
                            <img src={customLogoUrl} alt="custom logo" className="w-7 h-7 object-contain rounded border border-slate-200 bg-white" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-7 h-7 rounded-full border border-slate-300 border-dashed flex items-center justify-center text-[10px]">؟</div>
                          )}
                          <span className="text-[10px]">الشعار المخصص المرفوع</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* VISUAL HIGH-FIDELITY OFFICIAL ARABIC SCHOOL EXAM SHEET */}
                {generatedExam ? (
                  <div className="bg-white border-2 border-slate-800 p-8 md:p-12 shadow-2xl rounded-3xl mx-auto max-w-4xl exam-page" id="exam-rendered-paper">
                    
                    {/* Header Table Frame of classic Arab exam papers */}
                    <div className="grid grid-cols-3 text-center border-b border-slate-800 pb-4 text-xs md:text-sm text-slate-900 leading-relaxed">
                      
                      {/* Right side educational ministry indicator */}
                      <div className="text-right space-y-1">
                        <p className="font-black text-sm text-slate-900">الجمهورية العربية السورية</p>
                        <p className="font-bold text-sm text-slate-800">وزارة التربية والتعليم</p>
                        <p className="text-slate-700 text-xs font-semibold">امتحان مادة : <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 font-bold text-slate-950 inline-block">{generatedExam.subject}</span></p>
                      </div>

                      {/* Middle seal and crown replacement spacing */}
                      <div className="flex flex-col items-center justify-center space-y-1">
                        {selectedLogoType === "syria" && (
                          <div className="text-slate-900 shrink-0">
                            <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M32 4 C40 8, 48 6, 52 14 C56 22, 54 30, 48 38 C42 46, 32 58, 32 58 C32 58, 22 46, 16 38 C10 30, 8 22, 12 14 C16 6, 24 8, 32 4 Z" />
                              <path d="M32 16 L32 36" />
                              <path d="M24 24 L40 24" strokeWidth="2" />
                              <polyline points="20 42 32 30 44 42" />
                              <circle cx="32" cy="24" r="1.5" fill="currentColor" />
                              <circle cx="26" cy="30" r="1.5" fill="currentColor" />
                              <circle cx="38" cy="30" r="1.5" fill="currentColor" />
                            </svg>
                          </div>
                        )}
                        {selectedLogoType === "education" && (
                          <div className="text-slate-900 shrink-0">
                            <svg viewBox="0 0 24 24" className="w-11 h-11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                              <path d="M12 3v4" />
                              <circle cx="12" cy="3" r="1.5" fill="currentColor" />
                            </svg>
                          </div>
                        )}
                        {selectedLogoType === "school" && (
                          <div className="text-slate-900 shrink-0">
                            <Award className="w-11 h-11 text-slate-900" />
                          </div>
                        )}
                        {selectedLogoType === "default" && (
                          <div className="w-10 h-10 border-2 border-slate-900 rounded-lg rotate-45 flex items-center justify-center font-bold font-mono text-[9px] shadow-inner select-none shrink-0 text-slate-900">
                            حقوق
                          </div>
                        )}
                        {selectedLogoType === "custom" && customLogoUrl ? (
                          <img src={customLogoUrl} alt="custom exam logo" referrerPolicy="no-referrer" className="max-h-14 max-w-14 object-contain shrink-0" />
                        ) : selectedLogoType === "custom" ? (
                          <div className="text-[9px] text-rose-500 font-bold border border-rose-300 px-1 py-0.5 rounded text-center">أدرج شعاراً</div>
                        ) : null}
                        <p className="text-[9px] text-slate-500 font-bold tracking-wider">الامتحان الرسمي الموحد</p>
                      </div>

                      {/* Left Side subject details and timing fields */}
                      <div className="text-left space-y-1 font-semibold">
                        <p>اسم المادة: <span className="bg-slate-50 px-2.5 py-0.5 rounded border border-slate-200 mb-0.5 inline-block">{generatedExam.subject}</span></p>
                        <p>زمن الإجابة: <span className="bg-slate-50 px-2.5 py-0.5 rounded border border-slate-200 inline-block">{generatedExam.duration}</span></p>
                        <p>التاريخ: <span className="font-mono text-slate-500 text-xs">{new Date(generatedExam.created_at).toLocaleDateString("ar-EG")}</span></p>
                      </div>

                    </div>

                    {/* Centered Exam Title */}
                    <div className="text-center my-6 space-y-1">
                      <h3 className="text-xl md:text-2xl font-extrabold text-slate-900 font-sans tracking-wide">
                        {generatedExam.title}
                      </h3>
                      <p className="text-xs md:text-sm text-slate-600">
                        مستوى الصعوبة الإجمالي المستهدف: <span className="font-bold">{generatedExam.difficulty === "الكل" ? "امتحان شامل" : generatedExam.difficulty}</span>
                      </p>
                    </div>

                    {/* Class/School Blank Fields to match Google Stitch high-fidelity requirement */}
                    <div className="border border-slate-800 rounded-xl p-4 mb-6 grid grid-cols-2 text-xs md:text-sm leading-8 text-right bg-slate-50/50">
                      <div>
                        اسم الطالب: ___________________________
                      </div>
                      <div>
                        رقم الجلوس: _____________________
                      </div>
                      <div>
                        اسم المدرسة: _________________________
                      </div>
                      <div>
                        الصف والشعبة الدراسي: _____________
                      </div>
                    </div>

                    {/* Beautiful Academic double line spacer */}
                    <div className="academic-double-line" />

                    {/* INSTRUCTIONS */}
                    <div className="mb-6 p-3 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
                      <span className="text-blue-700 font-bold ml-1">تنبيهات وإرشادات هامة للطلاب:</span>
                      الرجاء قراءة كافة الأسئلة بدقة كاملة وتظليل الأجوبة في كراسة الإجابة الخاصة بك. جميع الأسئلة إجبارية وعلاماتها متساوية.
                    </div>

                    {/* PROCESS QUESTIONS TO FORM */}
                    <div className="space-y-8">
                      {generatedExam.questions.length > 0 ? (
                        generatedExam.questions.map((q, idx) => (
                          <div key={q.id} className="space-y-3 pb-6 border-b border-dashed border-slate-300 last:border-0 last:pb-0">
                            
                            {/* Question text with custom Arabic numeral indices */}
                            <div className="flex items-start gap-2.5">
                              <span className={`font-extrabold text-slate-900 bg-slate-900 text-white rounded-full flex items-center justify-center font-mono shrink-0 select-none ${
                                examFontSize === "sm" ? "w-6 h-6 text-xs" :
                                examFontSize === "lg" ? "w-8 h-8 text-lg" :
                                examFontSize === "xl" ? "w-9 h-9 text-xl" :
                                "w-7 h-7 text-base"
                              }`}>
                                {idx + 1}
                              </span>
                              <div className={`text-slate-900 font-bold pt-0.5 ${
                                examFontSize === "sm" ? "text-[13px] leading-normal" :
                                examFontSize === "lg" ? "text-[18px] leading-relaxed" :
                                examFontSize === "xl" ? "text-[21px] leading-loose" :
                                "text-[15px] leading-relaxed"
                              }`}>
                                {q.question_text}
                                <span className={`text-slate-400 font-normal mr-2 ${
                                  examFontSize === "sm" ? "text-[10px]" :
                                  examFontSize === "lg" ? "text-sm" :
                                  examFontSize === "xl" ? "text-base" :
                                  "text-xs"
                                }`}>[{q.subject} • {q.difficulty}]</span>
                              </div>
                            </div>
 
                            {/* Option list formatted as clean inline options block */}
                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${
                              examFontSize === "sm" ? "mr-7" :
                              examFontSize === "lg" ? "mr-10" :
                              examFontSize === "xl" ? "mr-11" :
                              "mr-9"
                            }`}>
                              {q.options && q.options.map((opt, oIdx) => (
                                <div key={oIdx} className={`flex items-center gap-3 border border-slate-200 hover:bg-slate-50 rounded-xl transition-all text-slate-800 ${
                                  examFontSize === "sm" ? "px-3 py-1.5 text-xs" :
                                  examFontSize === "lg" ? "px-4.5 py-3 text-[15px] font-bold" :
                                  examFontSize === "xl" ? "px-5 py-3.5 text-[18px] font-bold" :
                                  "px-4 py-2.5 text-sm font-medium"
                                }`}>
                                  <span className={`font-extrabold text-blue-700 bg-blue-50 rounded-lg flex items-center justify-center shadow-sm shrink-0 ${
                                    examFontSize === "sm" ? "w-6 h-6 text-xs" :
                                    examFontSize === "lg" ? "w-8 h-8 text-[15px]" :
                                    examFontSize === "xl" ? "w-9 h-9 text-[18px]" :
                                    "w-7 h-7"
                                  }`}>
                                    {oIdx === 0 ? "أ" : oIdx === 1 ? "ب" : oIdx === 2 ? "ج" : "د"}
                                  </span>
                                  <span>{opt}</span>
                                </div>
                              ))}
                            </div>
 
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 text-slate-400 border border-slate-200 rounded-3xl">
                          <p className="text-sm">لم يتم توليد أي أسئلة للامتحان بعد.</p>
                        </div>
                      )}
                    </div>

                    {/* MODEL ANSWERS KEY (Optional output conditional on checking toggle list) */}
                    {showModelAnswers && generatedExam.questions.length > 0 && (
                      <div className="mt-16 pt-12 border-t-2 border-slate-800 page-break">
                        <div className="text-center mb-6">
                          <h4 className="text-lg font-extrabold text-emerald-800 bg-emerald-50 inline-block px-6 py-2 rounded-xl border border-emerald-200">
                            مفتاح نموذج الإجابة الصحيحة (للمدرسين فقط) 🔐
                          </h4>
                          <p className="text-xs text-slate-400 mt-1">يجب إخفاء هذه الصفحة وإزالتها عند توزيع ورقة الامتحانات على الطلاب.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {generatedExam.questions.map((q, idx) => (
                            <div key={q.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-center justify-between">
                              <div className="space-y-1">
                                <p className="text-xs text-slate-500 font-semibold">السؤال رقم [{idx + 1}]</p>
                                <p className="text-xs font-bold text-slate-800 line-clamp-1">{q.question_text}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-blue-50 text-blue-750 px-2 py-0.5 rounded font-mono font-bold leading-none">{q.subject}</span>
                                <span className="bg-emerald-600 text-white font-extrabold text-sm w-9 h-9 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/10">
                                  {q.correct_answer}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-8 text-center border-t border-slate-200 pt-6 text-xs text-slate-400 leading-normal">
                          <p>صُممت ورقة الامتحان وسُجلت بنجاح عبر منظومة بنك الأسئلة الذكي Q-Bank Pro.</p>
                          <p className="font-mono mt-0.5">GENERATED AUTHENTIC ACADEMIC PAPER SYSTEM</p>
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="no-print bg-white p-12 border border-slate-200 rounded-3xl text-center text-slate-400 space-y-2.5 max-w-lg mx-auto">
                    <FileText className="w-12 h-12 mx-auto text-slate-300" />
                    <h3 className="text-base font-extrabold text-slate-700">لم يتم هندسة أي ورقة امتحان حالياً</h3>
                    <p className="text-xs leading-relaxed">يرجى ملء النموذج واختيار المعايير الأكاديمية المطلوبة، ثم الضغط على زر توليد وتحديث لتهيئة ومراجعة ورقة الامتحان بصيغة PDF.</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* VIEW D: DATABASE OPTIONS & JSON UTILITIES */}
            {activeView === "settings" && (
              <motion.div 
                key="settings-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 no-print max-w-3xl mx-auto"
              >
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">إدارة قواعد بيانات بنك الأسئلة المدرسية</h3>
                    <p className="text-xs text-slate-500">من هنا يمكنك حفظ نسخة احتياطية من جميع الأسئلة، إعادتها للحالة الافتراضية، أو استعادة الأسئلة من ملف خارجي بصيغة تدرج JSON.</p>
                  </div>

                  {/* Settings section row: backup/export items */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Backup box */}
                    <div className="border border-slate-200 rounded-2xl p-5 hover:border-blue-500 transition-all flex flex-col justify-between space-y-3">
                      <div>
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl w-fit">
                          <Download className="w-5 h-5" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 mt-3">تصدير قاعدة البيانات الحالية</h4>
                        <p className="text-xs text-slate-400 mt-1">حمل ملفاً محلياً يحتوي على جميع الأسئلة والخيارات والأساليب لمزامنته أو تشغيله كنسخة احتياطية آمنة.</p>
                      </div>
                      <button
                        onClick={handleExportBackup}
                        className="bg-slate-900 hover:bg-black text-white text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                      >
                        <Download className="w-4 h-4 text-blue-400" />
                        <span>تحميل النسخة الاحتياطية (JSON) 📥</span>
                      </button>
                    </div>

                    {/* Restore file upload box */}
                    <div className="border border-slate-200 rounded-2xl p-5 hover:border-blue-500 transition-all flex flex-col justify-between space-y-3">
                      <div>
                        <div className="p-2.5 bg-slate-100 text-slate-600 rounded-xl w-fit">
                          <Upload className="w-5 h-5" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 mt-3">استعادة نسخة احتياطية سابقة</h4>
                        <p className="text-xs text-slate-400 mt-1">قم برفع ملف JSON يحتوي على بنك أسئلة مسبق لدمجه تلقائياً مع بنك الأسئلة الحالي دون حذف العناصر القديمة.</p>
                      </div>
                      
                      <div className="relative">
                        <input
                          id="settings-import-backup-file"
                          type="file"
                          accept=".json"
                          onChange={handleImportBackup}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <button
                          type="button"
                          className="w-full bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                          <Upload className="w-4 h-4 text-blue-600" />
                          <span>رفع واستعادة ملف داتا الاحتياطي 📤</span>
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Danger zone line */}
                  <div className="border-t border-slate-200 pt-6 space-y-4">
                    <h4 className="text-sm font-bold text-red-600">منطقة الأوامر الحساسة</h4>
                    
                    <div className="bg-red-50/50 border border-red-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div>
                        <h5 className="text-xs font-bold text-red-800">إعادة ضبط كامل البنك وحذف التخصيص</h5>
                        <p className="text-[11px] text-red-600 mt-0.5">تحذير! سيتم استبدال وحذف جميع أسئلتك المضافة واستعادة الأسئلة النموذجية الأولية فقط.</p>
                      </div>
                      <button
                        onClick={handleResetDatabase}
                        className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all w-full md:w-auto justify-center cursor-pointer shadow-md shadow-red-600/10"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>إعادة تهيئة البنك بالكامل ⚙️</span>
                      </button>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {/* VIEW E: ADMIN CONTROL BOARD (EXCLUSIVE TO admin@qbank.com) */}
            {activeView === "admin" && user?.email === "admin@qbank.com" && (
              <motion.div 
                key="admin-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 no-print max-w-5xl mx-auto"
              >
                {/* 👑 STATS BANNER */}
                <div className="bg-gradient-to-r from-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-right">
                    <div className="space-y-1.5 text-right flex-1">
                      <span className="bg-indigo-500/30 text-indigo-200 text-[10px] font-black px-2.5 py-1 rounded-md uppercase font-sans tracking-wider">
                        لوحة الإدارة الإستراتيجية 👑
                      </span>
                      <h3 className="text-xl font-black font-sans leading-tight">غرفة التحكم المركزية لـ Q-Bank Pro</h3>
                      <p className="text-xs text-indigo-200 leading-relaxed max-w-xl">
                        في هذه الواجهة الخاصة بمسؤول المنظومة، يمكنك تتبع وإدارة حسابات المعلمين المسجلين، تصفح وجلب كافة أسئلتهم في ثوانٍ بضغطة زر واحدة، وضبط سلامة المحتوى بحذف الحسابات أو المواد المخالفة.
                      </p>
                    </div>

                    <button
                      onClick={fetchAllTeachersQuestions}
                      disabled={isAdminLoading}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-6 py-4 rounded-2xl flex items-center gap-3 transition-all cursor-pointer shadow-lg shadow-indigo-600/30 shrink-0 self-stretch md:self-auto justify-center"
                    >
                      <RefreshCw className={`w-4 h-4 ${isAdminLoading ? "animate-spin" : ""}`} />
                      <span>جلب ومزامنة بنك الأسئلة الشاملة 📥</span>
                    </button>
                  </div>

                  {/* Summary Counters Bar */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10 text-right">
                    <div className="space-y-1">
                      <span className="text-[10px] text-indigo-300 font-bold block">إجمالي المعلمين بالمنصة 🧑‍🏫</span>
                      <span className="text-xl font-black text-white font-mono">{teachers.length} معلم</span>
                    </div>
                    <div className="space-y-1 border-r border-white/10 pr-4 font-sans">
                      <span className="text-[10px] text-indigo-300 font-bold block">إجمالي الأسئلة المتاحة 📚</span>
                      <span className="text-xl font-black text-white font-mono">
                        {allTeachersQuestions.length > 0 ? `${allTeachersQuestions.length} سؤال` : "اضغط للمزامنة"}
                      </span>
                    </div>
                    <div className="space-y-1 border-r border-white/10 pr-4 font-sans">
                      <span className="text-[10px] text-indigo-300 font-bold block">متوسط أسئلة كل معلم 📈</span>
                      <span className="text-xl font-black text-white font-mono">
                        {teachers.length > 0 ? (allTeachersQuestions.length / teachers.length).toFixed(1) : "0"} أسئلة
                      </span>
                    </div>
                    <div className="space-y-1 border-r border-white/10 pr-4 font-sans">
                      <span className="text-[10px] text-indigo-300 font-bold block">صلاحيات مستوى المدير 🔐</span>
                      <span className="text-xs font-extrabold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-md w-fit block mt-1">
                        حق الوصول الفيدرالي الكامل
                      </span>
                    </div>
                  </div>
                </div>

                {/* 🧑‍🏫 SECTION 1: TEACHER PROFILE MANAGEMENT */}
                <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div className="text-right">
                      <h4 className="text-sm font-black text-slate-800 font-sans">قائمة المعلمين وحسابات الفصول 🧑‍🏫</h4>
                      <p className="text-[11px] text-slate-400">إدارة ملفات المعلمين الفاعلين وحذفهم لإزالة بياناتهم تماماً</p>
                    </div>

                    <div className="relative w-full sm:w-72">
                      <span className="absolute inset-y-0 right-3 flex items-center pr-1 text-slate-400 pointer-events-none">
                        <Search className="w-3.5 h-3.5" />
                      </span>
                      <input
                        type="text"
                        placeholder="ابحث عن معلم بالبريد الإلكتروني..."
                        value={adminUserSearch}
                        onChange={(e) => setAdminUserSearch(e.target.value)}
                        className="w-full text-right bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800"
                      />
                    </div>
                  </div>

                  {isAdminLoading && teachers.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 space-y-2">
                      <RefreshCw className="w-8 h-8 mx-auto text-indigo-500 animate-spin" />
                      <p className="text-xs font-bold font-sans">برجاء الانتظار، جاري تنزيل بيانات الملقمات الأمنية...</p>
                    </div>
                  ) : teachers.filter(t => t.email.toLowerCase().includes(adminUserSearch.toLowerCase())).length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/80 text-slate-500 border-b border-slate-100">
                            <th className="py-3.5 px-4 font-bold">البريد الإلكتروني 📧</th>
                            <th className="py-3.5 px-4 font-bold">رقم التعريف السحابي (UID) 🔑</th>
                            <th className="py-3.5 px-4 font-bold">تاريخ الانضمام 📅</th>
                            <th className="py-3.5 px-4 font-bold">مساهمة الأسئلة 📊</th>
                            <th className="py-3.5 px-2 font-bold text-center">عمليات الحذف 🗑️</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {teachers.filter(t => t.email.toLowerCase().includes(adminUserSearch.toLowerCase())).map((teacher) => {
                            const teacherQuestionsCount = allTeachersQuestions.filter(q => q.userId === teacher.id).length;
                            return (
                              <tr key={teacher.id} className="hover:bg-slate-50/50 transition">
                                <td className="py-3.5 px-4 font-extrabold select-all text-slate-900">{teacher.email}</td>
                                <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400 select-all">{teacher.id}</td>
                                <td className="py-3.5 px-4 text-slate-500">
                                  {teacher.createdAt ? new Date(teacher.createdAt).toLocaleString("ar-EG") : "غير محدد"}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md font-mono">
                                    {teacherQuestionsCount} سؤال
                                  </span>
                                </td>
                                <td className="py-3.5 px-2 text-center font-sans">
                                  <button
                                    id={`btn-delete-teacher-${teacher.id}`}
                                    onClick={() => setDeleteTeacherConfirmId(teacher.id)}
                                    className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-lg font-bold border border-red-100 transition cursor-pointer"
                                  >
                                    حذف المعلم والبنك الخاص به 🗑️
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-10 text-center text-slate-400 text-xs text-sans">
                      لا يوجد معلمون فاعلون ينطبق عليهم شرط البحث حالياً.
                    </div>
                  )}
                </div>

                {/* 📚 SECTION 2: GLOBAL QUESTIONS LIST SCREEN */}
                {allTeachersQuestions.length > 0 && (
                  <div className="bg-white rounded-3xl border border-slate-200 shadow-md p-6 space-y-4 font-sans">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div className="text-right">
                        <h4 className="text-sm font-black text-slate-800 font-sans">تصفح الأسئلة الشاملة للمعلمين الآخرين 📚</h4>
                        <p className="text-[11px] text-slate-400">تصفية وبحث وحذف فوري للأسئلة المرفوعة من المعلمين</p>
                      </div>

                      <div className="relative w-full sm:w-72">
                        <span className="absolute inset-y-0 right-3 flex items-center pr-1 text-slate-400 pointer-events-none">
                          <Search className="w-3.5 h-3.5" />
                        </span>
                        <input
                          type="text"
                          placeholder="ابحث عن نص، مادة، أو إيميل معلم..."
                          value={adminQuestionSearch}
                          onChange={(e) => setAdminQuestionSearch(e.target.value)}
                          className="w-full text-right bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs font-semibold focus:outline-none focus:border-indigo-500 text-slate-800"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {allTeachersQuestions.filter(q => {
                        return q.question_text.toLowerCase().includes(adminQuestionSearch.toLowerCase()) ||
                               q.subject.toLowerCase().includes(adminQuestionSearch.toLowerCase()) ||
                               (q.creatorEmail && q.creatorEmail.toLowerCase().includes(adminQuestionSearch.toLowerCase()));
                      }).map((q) => {
                        return (
                          <div 
                            key={q.id}
                            className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-sm hover:border-indigo-400 transition"
                          >
                            <div className="space-y-2 text-right">
                              {/* Meta Indicators */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5 text-right">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                                    المادة: {q.subject}
                                  </span>
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                                    q.difficulty === "سهل" ? "bg-emerald-50 text-emerald-600" :
                                    q.difficulty === "متوسط" ? "bg-blue-50 text-blue-600" :
                                    "bg-rose-50 text-rose-600"
                                  }`}>{q.difficulty}</span>
                                </div>
                                <span className="text-[10px] font-extrabold text-slate-500 bg-slate-200/70 px-2.5 py-0.5 rounded-full select-all">
                                  ✉️ {q.creatorEmail || "معطيات مجهولة"}
                                </span>
                              </div>

                              {/* Question Body Text */}
                              <p className="text-xs font-black text-slate-900 leading-relaxed text-right select-all">
                                {q.question_text}
                              </p>

                              {/* Options List */}
                              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600">
                                {q.options.map((opt, i) => {
                                  const letter = i === 0 ? "أ" : i === 1 ? "ب" : i === 2 ? "ج" : "د";
                                  const isCorrect = q.correct_answer === letter;
                                  return (
                                    <div 
                                      key={i} 
                                      className={`p-2 rounded-xl text-right flex items-center gap-1.5 border font-medium ${
                                        isCorrect 
                                          ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-extrabold" 
                                          : "bg-white border-slate-100"
                                      }`}
                                    >
                                      <span className={`font-mono font-black w-4 h-4 rounded text-[9px] shrink-0 flex items-center justify-center ${
                                        isCorrect ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                                      }`}>
                                        {letter}
                                      </span>
                                      <span className="truncate">{opt}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Deletion Button Footer for questions */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/60 no-print">
                              <span className="text-[9px] text-slate-400 font-mono">ID: {q.id.slice(0, 8)}...</span>
                              <button
                                onClick={() => setDeleteConfirmId(q.id)}
                                className="px-2.5 py-1 text-[10px] font-black text-rose-600 bg-rose-50 hover:bg-rose-600 hover:text-white rounded-lg border border-rose-100 cursor-pointer transition-all flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف هذا السؤال نهائياً</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {allTeachersQuestions.filter(q => {
                        return q.question_text.toLowerCase().includes(adminQuestionSearch.toLowerCase()) ||
                               q.subject.toLowerCase().includes(adminQuestionSearch.toLowerCase()) ||
                               (q.creatorEmail && q.creatorEmail.toLowerCase().includes(adminQuestionSearch.toLowerCase()));
                      }).length === 0 && (
                        <div className="col-span-full py-8 text-center text-slate-400 text-xs">
                          لم يتم العثور على أي أسئلة تطابق مدخلات البحث الحالية.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </section>

      </main>

      {/* DYNAMIC BACKDROP MODAL: ADD / EDIT QUESTION MANUAL (Hidden when printing obviously) */}
      <AnimatePresence>
        {showQuestionModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print" style={{ direction: "rtl" }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-xl shadow-2xl border border-slate-200 text-right text-slate-800 relative space-y-4"
            >
              <button 
                onClick={() => setShowQuestionModal(false)}
                className="absolute top-4 left-4 p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <h3 className="text-lg font-bold text-slate-900 font-sans">
                  {modalMode === "create" ? "➕ إضافة سؤال تعليمي جديد" : "📝 تعديل تفاصيل وصياغة السؤال الأكاديمي"}
                </h3>
                <p className="text-xs text-slate-400">يرجى تعبئة كافة التفاصيل بشكل دقيق وبأحرف مطابقة لخطوط المدارج التعليمية.</p>
              </div>

              <form onSubmit={handleSaveQuestion} className="space-y-4">
                
                {/* Question Textarea */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500">نص محتوى وموضوع السؤال:</label>
                  <textarea
                    required
                    value={formQuestionText}
                    onChange={(e) => setFormQuestionText(e.target.value)}
                    placeholder="مثال: احسب قياس الزاوية المفقودة س في المحاور الدائرية..."
                    rows={3}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-800 font-medium text-right resize-none"
                  />
                </div>

                {/* Subject & Difficulty Selection Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">المادة والتخصص:</label>
                    <select
                      value={formSubject}
                      onChange={(e) => setFormSubject(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {subjectsList.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">درجة الصعوبة المعتمدة:</label>
                    <select
                      value={formDifficulty}
                      onChange={(e) => setFormDifficulty(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="سهل">سهل</option>
                      <option value="متوسط">متوسط</option>
                      <option value="صعب">صعب</option>
                    </select>
                  </div>
                </div>

                {/* Multiple choice inputs */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-500">الخيارات الأربعة البديلة للطلاب:</label>
                  
                  <div className="space-y-2.5">
                    {formOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-xs text-blue-700 bg-blue-50 w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border border-blue-100">
                          {idx === 0 ? "أ" : idx === 1 ? "ب" : idx === 2 ? "ج" : "د"}
                        </span>
                        <input
                          required
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const updated = [...formOptions];
                            updated[idx] = e.target.value;
                            setFormOptions(updated);
                          }}
                          placeholder={`الخيار البديل للرمز ${idx === 0 ? "أ" : idx === 1 ? "ب" : idx === 2 ? "ج" : "د"}...`}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-right font-medium"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Selector for Correct choice indicator */}
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-500">حدد رمز الإجابة الصحيحة الفعلي:</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">سيتم تصنيف هذا الخيار كـ الجواب الصحيح بنموذج إجابة المعلمين لقائمتنا.</p>
                  </div>
                  <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden shrink-0 shadow-sm">
                    {["أ", "ب", "ج", "د"].map((ltr) => (
                      <button
                        key={ltr}
                        type="button"
                        onClick={() => setFormCorrectAnswer(ltr)}
                        className={`px-4 py-1.5 text-xs font-bold border-l border-slate-100 last:border-0 transition-all ${
                          formCorrectAnswer === ltr 
                            ? "bg-blue-600 text-white" 
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {ltr}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form Action buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowQuestionModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                  >
                    إلغاء التراجع
                  </button>
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    حفظ وإدراج 💾
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CUSTOM CONFIRMATION DIALOG: DELETE QUESTION */}
      <AnimatePresence>
        {deleteConfirmId && (() => {
          const questionToDelete = questions.find(q => q.id === deleteConfirmId);
          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print" style={{ direction: "rtl" }}>
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 text-right text-slate-800 space-y-5"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 text-right">
                    <h3 className="text-base font-black text-slate-900 font-sans">تأكيد حذف السؤال نهائياً؟ ⚠️</h3>
                    <p className="text-xs text-slate-400">ستفقد المعطيات وسيحذف هذا السؤال تماماً من السحابة.</p>
                  </div>
                </div>

                {questionToDelete && (
                  <div className="bg-slate-50/85 rounded-2xl p-4 border border-slate-100 space-y-2 text-right">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold text-slate-500">مادة: {questionToDelete.subject}</span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                        questionToDelete.difficulty === "سهل" ? "bg-emerald-50 text-emerald-600" :
                        questionToDelete.difficulty === "متوسط" ? "bg-blue-50 text-blue-600" :
                        "bg-rose-50 text-rose-600"
                      }`}>{questionToDelete.difficulty}</span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed line-clamp-3 select-all">
                      {questionToDelete.question_text}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-3 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer text-center"
                  >
                    إلغاء التراجع
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(deleteConfirmId)}
                    className="flex-1 py-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md shadow-red-500/10 cursor-pointer transition text-center"
                  >
                    تأكيد الحذف النهائي
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* CUSTOM CONFIRMATION DIALOG: DELETE TEACHER */}
      <AnimatePresence>
        {deleteTeacherConfirmId && (() => {
          const teacherToDelete = teachers.find(t => t.id === deleteTeacherConfirmId);
          return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print" style={{ direction: "rtl" }}>
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 text-right text-slate-800 space-y-5 font-sans"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 text-right">
                    <h3 className="text-base font-black text-slate-900">حذف المعلم نهائياً وصرف حسابه؟ ⚠️</h3>
                    <p className="text-xs text-slate-400">تحذير: سيتم حذف ملف تعريف المعلم وكافة أسئلته ومسوداته التعليمية من السيرفر السحابي فوراً.</p>
                  </div>
                </div>

                {teacherToDelete && (
                  <div className="bg-red-50/40 rounded-2xl p-4 border border-red-100/50 space-y-2 text-right">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold text-red-600">⚠️ سيتم حذف كامل الداتا</span>
                      <span className="text-[10px] text-slate-400">رقم التعريف: {teacherToDelete.id.slice(0, 8)}...</span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium select-all">
                      البريد الإلكتروني للهدف: <strong>{teacherToDelete.email}</strong>
                    </p>
                    <p className="text-[10px] text-slate-400">تاريخ التسجيل بالمنصة: {teacherToDelete.createdAt ? new Date(teacherToDelete.createdAt).toLocaleDateString("ar-EG") : "غير محدد"}</p>
                  </div>
                )}

                <div className="flex items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTeacherConfirmId(null)}
                    className="flex-1 py-3 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer text-center font-sans"
                  >
                    تراجع، إلغاء الحذف
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTeacher(deleteTeacherConfirmId)}
                    className="flex-1 py-3 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md cursor-pointer transition text-center font-sans"
                  >
                    تأكيد حذف المعلم وأسئلته
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* SYSTEM-WIDE CUSTOM CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmConfig && confirmConfig.isOpen && (
          <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print" style={{ direction: "rtl" }}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 text-right text-slate-800 space-y-5 font-sans"
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                  confirmConfig.type === "danger" ? "bg-rose-50 border-rose-100 text-rose-600" :
                  confirmConfig.type === "warning" ? "bg-amber-50 border-amber-100 text-amber-600" :
                  "bg-blue-50 border-blue-100 text-blue-600"
                }`}>
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1 text-right">
                  <h3 className="text-base font-black text-slate-900">{confirmConfig.title}</h3>
                  <p className="text-xs text-slate-400">يرجى تأكيد الإجراء للاستمرار.</p>
                </div>
              </div>

              <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100 text-right text-xs text-slate-600 leading-relaxed font-medium">
                {confirmConfig.message}
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmConfig(null)}
                  className="flex-1 py-3 text-xs font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer text-center font-sans"
                >
                  {confirmConfig.cancelText || "إلغاء"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    confirmConfig.action();
                  }}
                  className={`flex-1 py-3 text-xs font-bold text-white rounded-xl shadow-md transition cursor-pointer text-center font-sans ${
                    confirmConfig.type === "danger" ? "bg-rose-600 hover:bg-rose-700 shadow-rose-500/10" :
                    confirmConfig.type === "warning" ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/10" :
                    "bg-blue-600 hover:bg-blue-700 shadow-blue-500/10"
                  }`}
                >
                  {confirmConfig.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
