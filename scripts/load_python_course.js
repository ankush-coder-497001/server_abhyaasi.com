#!/usr/bin/env node

/**
 * Python Beginner Course Loader
 * This script loads the Python Beginner course into the Abhyaasi database
 * 
 * Usage: node load_python_course.js
 * 
 * Prerequisites:
 * - MongoDB connection configured in environment
 * - Mongoose models imported
 * - Database initialized
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Import models
const Course = require('../models/course.model');
const Module = require('../models/module.model');
const Profession = require('../models/profession.model');

// Course JSON path
const COURSE_JSON_PATH = path.join(__dirname, '..', 'courses', 'python-beginner.course.json');

/**
 * Load course JSON file
 */
function loadCourseJSON() {
  try {
    console.log('📖 Loading course JSON...');
    const data = fs.readFileSync(COURSE_JSON_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('❌ Error loading course JSON:', error.message);
    process.exit(1);
  }
}

/**
 * Create course in database
 */
async function createCourse(courseData) {
  try {
    console.log('📚 Creating course: ' + courseData.course.title);

    const courseDoc = new Course({
      title: courseData.course.title,
      slug: courseData.course.slug,
      description: courseData.course.description,
      difficulty: courseData.course.difficulty,
      duration: courseData.course.duration,
      thumbnailUrl: courseData.course.thumbnailUrl,
      status: courseData.course.status,
      isPublished: courseData.course.isPublished,
      modules: [] // Will populate after creating modules
    });

    await courseDoc.save();
    console.log('✅ Course created:', courseDoc._id);
    return courseDoc;
  } catch (error) {
    console.error('❌ Error creating course:', error.message);
    throw error;
  }
}

/**
 * Create all modules for a course
 */
async function createModules(courseData, courseId) {
  try {
    console.log(`📖 Creating ${courseData.modules.length} modules...`);

    const moduleIds = [];

    for (const moduleData of courseData.modules) {
      console.log(`  ├─ ${moduleData.title}`);

      const moduleDoc = new Module({
        courseId: courseId,
        title: moduleData.title,
        order: moduleData.order,
        topics: moduleData.topics || [],
        theoryNotes: moduleData.theoryNotes || {},
        mcqs: moduleData.mcqs || [],
        codingTask: moduleData.codingTask || null,
        interviewQuestions: moduleData.interviewQuestions || [],
        passCriteria: moduleData.passCriteria || {
          mcqPassingPercent: 70,
          projectMustPass: true
        },
        published: moduleData.published || true,
        isLastModule: moduleData.isLastModule || false
      });

      await moduleDoc.save();
      moduleIds.push(moduleDoc._id);
      console.log(`  └─ ✅ Module created: ${moduleDoc._id}`);
    }

    return moduleIds;
  } catch (error) {
    console.error('❌ Error creating modules:', error.message);
    throw error;
  }
}

/**
 * Link modules to course
 */
async function linkModulesToCourse(courseId, moduleIds) {
  try {
    console.log('🔗 Linking modules to course...');

    const course = await Course.findById(courseId);
    course.modules = moduleIds;
    await course.save();

    console.log(`✅ Linked ${moduleIds.length} modules to course`);
  } catch (error) {
    console.error('❌ Error linking modules:', error.message);
    throw error;
  }
}

/**
 * Create profession and link course
 */
async function createProfession(courseData, courseId) {
  try {
    console.log('💼 Creating Python Developer profession...');

    // Check if profession already exists
    let profession = await Profession.findOne({ name: 'Python Developer' });

    if (profession) {
      console.log('ℹ️  Profession already exists, updating...');
    } else {
      profession = new Profession({
        name: 'Python Developer',
        description: 'Master Python programming from basics to advanced',
        thumbnail: courseData.course.thumbnailUrl,
        estimatedDuration: '8 weeks',
        tags: ['python', 'programming', 'beginner', 'web-development'],
        isPublished: true
      });
    }

    // Add course to profession
    const courseInProfession = profession.courses.find(
      c => c.course && c.course.toString() === courseId.toString()
    );

    if (!courseInProfession) {
      profession.courses.push({
        course: courseId,
        order: 1
      });
    }

    await profession.save();
    console.log('✅ Profession created/updated:', profession._id);

    // Link profession to course
    const course = await Course.findById(courseId);
    course.profession = profession._id;
    await course.save();

    console.log('✅ Course linked to profession');
  } catch (error) {
    console.error('❌ Error creating profession:', error.message);
    throw error;
  }
}

/**
 * Main loading function
 */
async function loadCourse() {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  Python Beginner Course Loader        ║');
    console.log('║  Abhyaasi.com - Learn, Build, Achieve ║');
    console.log('╚════════════════════════════════════════╝\n');

    // Load JSON
    const courseData = loadCourseJSON();

    // Create course
    const course = await createCourse(courseData);

    // Create modules
    const moduleIds = await createModules(courseData, course._id);

    // Link modules to course
    await linkModulesToCourse(course._id, moduleIds);

    // Create profession
    await createProfession(courseData, course._id);

    // Display summary
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  Course Loading Successful! ✅         ║');
    console.log('╚════════════════════════════════════════╝\n');

    console.log('📊 Summary:');
    console.log(`  • Course ID: ${course._id}`);
    console.log(`  • Title: ${course.title}`);
    console.log(`  • Modules: ${moduleIds.length}`);
    console.log(`  • Status: ${course.status}`);
    console.log(`  • Duration: ${course.duration}`);
    console.log(`  • Difficulty: ${course.difficulty}`);

    // Display module breakdown
    console.log('\n📚 Module Breakdown:');
    courseData.modules.forEach((mod, idx) => {
      console.log(`  ${idx + 1}. ${mod.title}`);
      console.log(`     ├─ Topics: ${(mod.topics || []).length}`);
      console.log(`     ├─ MCQs: ${(mod.mcqs || []).length}`);
      console.log(`     ├─ Project: ${mod.codingTask ? '✅' : '❌'}`);
      console.log(`     └─ Interview Q: ${(mod.interviewQuestions || []).length}`);
    });

    // Statistics
    console.log('\n📈 Statistics:');
    const totalMCQs = courseData.modules.reduce((sum, m) => sum + (m.mcqs || []).length, 0);
    const totalProjects = courseData.modules.filter(m => m.codingTask).length;
    const totalInterviewQs = courseData.modules.reduce((sum, m) => sum + (m.interviewQuestions || []).length, 0);

    console.log(`  • Total MCQs: ${totalMCQs}`);
    console.log(`  • Total Projects: ${totalProjects}`);
    console.log(`  • Interview Questions: ${totalInterviewQs}`);

    console.log('\n✨ Course is ready for student enrollment!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Connect to MongoDB and run the loader
async function run() {
  try {
    // Load environment variables
    require('dotenv').config();

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/abhyaasi');
    console.log('✅ Connected to MongoDB\n');

    await loadCourse();
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    process.exit(1);
  }
}

// Run the script
run();
