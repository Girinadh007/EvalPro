# 🎯 Evaluation Hub Pro

> **A High-Performance, Glassmorphism-UI Evaluation System for Hackathons, Presentations, and Academic Reviews.**

![Project Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Supabase%20%7C%20Framer%20Motion-blue)
![UI Style](https://img.shields.io/badge/UI-Glassmorphism-purple)

Evaluation Hub Pro is a modern web application designed to streamline the grading process for large-scale events. It bridges the gap between administrators (Heads) and reviewers, providing real-time synchronization, student-wise consolidated reporting, and a premium user experience.

---

## ✨ Features

### 👑 Admin Power (Head Portal)
- **Fluid Event Creation**: Define evaluation events with customizable sessions and criteria.
- **Bulk Student Import**: Upload `.xlsx` spreadsheets with intelligent "Fill Down" logic for team names.
- **Robust Data Handling**: Automatic deduplication and upsert logic to prevent errors when re-uploading student data.
- **Criteria Management**: Set up multi-session grading criteria (e.g., Logic, UI, Presentation) with weighted marks.
- **Smart Data Export**: Download consolidated student-wise reports including **Reviewer Names**, timestamps, attendance, and session totals.
- **Security Check**: Password-protected access for administrative functions.

### 🔍 Reviewer Workflow
- **Persistent Identity**: Set your reviewer name once (e.g., "Luffy" or "Reviewer 1") and have it automatically linked to every evaluation you submit. Persistent via `localStorage`.
- **Precision Search**: Real-time team lookup by **Team Name** or **Individual Student Name**.
- **Live Attendance**: Mark attendance for each student within the review flow.
- **Text-Based Marking**: Clean number inputs with maximum-mark validation instead of imprecise range sliders.
- **Multi-Event Support**: Quick-switch between different active events via a premium selection step.
- **Concurrency Control**: Built-in database constraints to ensure data integrity even when multiple reviewers work simultaneously.

### 💎 Design & UX
- **Glassmorphism UI**: A sleek, translucent interface with vibrant gradients and modern typography.
- **Micro-interactions**: Smooth transitions powered by `framer-motion`.
- **Responsive Layout**: Designed to work flawlessly on tablets and laptops for on-the-go reviewing.

---

## 🛠 Tech Stack

- **Frontend**: [React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Vanilla CSS](https://developer.mozilla.org/en-US/docs/Web/CSS) (Modern CSS Variables & Glassmorphism)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Backend & Database**: [Supabase](https://supabase.com/) (PostgreSQL + RLS)
- **Data Processing**: [SheetJS (XLSX)](https://sheetjs.com/)
- **Notifications**: [React Hot Toast](https://react-hot-toast.com/)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18 or higher)
- A Supabase Project

### 2. Database Setup
Run the contents of `schema.sql` in your Supabase **SQL Editor** to create the required tables and Row Level Security policies.

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_public_key
VITE_ADMIN_PASSWORD=your_secure_password
```

### 4. Installation & Run
```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

---

## 📊 Excel Import Format

To import students, your Excel file should contain these columns (case-insensitive):

| student_id | name | team_id |
| :--- | :--- | :--- |
| S101 | John Doe | Team Alpha |
| S102 | Jane Smith | Team Alpha |
| S201 | Alice Brown | Team Beta |

*Note: The system intelligently fills down the team name if a student row is missing it.*

---

## 🔒 Security Summary
The system utilizes **Row Level Security (RLS)** in Supabase to manage public permissions. For production deployment, ensure the "Delete" and "Update" policies are restricted to authenticated roles.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

---

**Built with ❤️ for better evaluations.**
