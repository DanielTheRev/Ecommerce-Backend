import { HeroSeeder } from '../services/hero.seeder';
import { connectDB } from '../config/database';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const runSeed = async () => {
    try {
        await connectDB();
        await HeroSeeder.seed();
        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding:', error);
        process.exit(1);
    }
};

runSeed();
