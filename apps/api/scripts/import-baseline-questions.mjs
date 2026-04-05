import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

async function importBaselineQuestions() {
  try {
    // Read the baseline question set
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const baselinePath = path.join(__dirname, 'baseline-question-set.json');
    const baselineData = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    
    // Extract just the questions array for the format expected by the system
    const questions = baselineData.questions.map(q => q.question);
    
    // Create the question set in the database
    const questionSet = await prisma.evalQuestionSet.create({
      data: {
        tenantId: 'default-tenant',
        ownerId: 'default-user',
        name: 'baseline-question-set-v1',
        description: 'Comprehensive baseline question set for RAG system quality evaluation',
        questionsJson: questions
      }
    });
    
    console.log('Baseline question set created successfully:', questionSet.id);
    
    // Create a baseline snapshot
    const snapshot = await prisma.evalQuestionSetBaselineSnapshot.create({
      data: {
        tenantId: 'default-tenant',
        ownerId: 'default-user',
        questionSetId: questionSet.id,
        version: questionSet.currentVersion,
        name: questionSet.name,
        description: questionSet.description,
        questionsJson: questionSet.questionsJson
      }
    });
    
    console.log('Baseline snapshot created successfully:', snapshot.id);
    
    // Set the baseline snapshot for the question set
    await prisma.evalQuestionSet.update({
      where: { id: questionSet.id },
      data: {
        baselineSnapshotId: snapshot.id,
        baselineChosenAt: new Date()
      }
    });
    
    console.log('Baseline snapshot set as active for the question set');
    
  } catch (error) {
    console.error('Error importing baseline questions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importBaselineQuestions();
