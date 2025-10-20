<center> # Abhyasi.com </center>
# Project Backend Documentation

# Backend API Documentation

## Overview

This backend powers an e-learning platform with structured courses, modules, topics, MCQs, coding challenges (mini projects), interview questions, leaderboard, badges, and certificates. It provides APIs for user enrollment, module progress tracking, submissions, and achievements.

## Features

* User Authentication & Enrollment
* Courses & Modules Management
* Topics, MCQs, Theory, and Mini Projects
* Interview Questions Download
* Submissions with Test Case Validation
* Leaderboard & Badges System
* Certificates for Course Completion

## Tech Stack

* **Node.js**, **Express.js**, **MongoDB**, **Mongoose**
* **JWT Authentication**
* **RESTful APIs**

## Folder Structure

```
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middlewares/
│   ├── utils/
│   └── app.js
├── package.json
├── README.md
└── .env
```

## Schemas (Mongoose Models)

* **User**
* **Course**
* **Module**
* **Submission**
* **Leaderboard**
* **Badge**
* **Certificate**

## API Endpoints

### Authentication

| Method | Endpoint       | Description   |
| ------ | -------------- | ------------- |
| POST   | /auth/register | Register User |
| POST   | /auth/login    | Login User    |

### Courses

| Method | Endpoint     | Description      |
| ------ | ------------ | ---------------- |
| GET    | /courses     | Get All Courses  |
| GET    | /courses/:id | Get Course by ID |
| POST   | /courses     | Create Course    |

### Modules

| Method | Endpoint     | Description      |
| ------ | ------------ | ---------------- |
| GET    | /modules/:id | Get Module by ID |
| POST   | /modules     | Create Module    |
| PUT    | /modules/:id | Update Module    |

### Submissions

| Method | Endpoint             | Description                  |
| ------ | -------------------- | ---------------------------- |
| POST   | /submissions         | Submit Project/MCQ Responses |
| GET    | /submissions/:userId | Get User Submissions         |

### Leaderboard

| Method | Endpoint     | Description        |
| ------ | ------------ | ------------------ |
| GET    | /leaderboard | Global Leaderboard |

### Badges & Certificates

| Method | Endpoint              | Description          |
| ------ | --------------------- | -------------------- |
| GET    | /badges               | Get All Badges       |
| GET    | /certificates/:userId | Get User Certificate |

## Environment Variables (.env)

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/elearning
JWT_SECRET=your_jwt_secret
```

## Setup Guide

### 1️⃣ Clone Repository

```bash
git clone https://github.com/your-repo/elearning-backend.git
cd elearning-backend
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Create `.env` File

```bash
PORT=5000
MONGO_URI=mongodb://localhost:27017/elearning
JWT_SECRET=your_jwt_secret
```

### 4️⃣ Start Server

```bash
npm run dev
```

## Future Enhancements

* Payment Integration
* AI-based Interview Question Generator
* Admin Dashboard Panel

---

**Author:** Ankush Kumar Gupta
**License:** MIT
