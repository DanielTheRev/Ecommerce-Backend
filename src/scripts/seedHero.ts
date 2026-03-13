import { HeroSeeder } from './hero.seeder';
import { getModelsForConnection } from '../config/modelRegistry';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const runSeed = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vura_store_db';
        await mongoose.connect(mongoURI);
        const models = getModelsForConnection(mongoose.connection);
        await HeroSeeder.seed(models);
        console.log('Done!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding:', error);
        process.exit(1);
    }
};

runSeed();
