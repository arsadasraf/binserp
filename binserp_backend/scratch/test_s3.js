import { S3Client, ListBucketsCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const s3Client = new S3Client({
    region: process.env.S3_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    },
});

async function testS3() {
    console.log("Testing S3 connection...");
    try {
        // 1. Skip ListBuckets as it often requires higher permissions
        // console.log("Successfully connected. Buckets found:", listResponse.Buckets.map(b => b.Name));

        // 2. Test upload
        const testFile = "test-upload.txt";
        fs.writeFileSync(testFile, "Hello S3!");
        
        const key = `tests/${Date.now()}-test.txt`;
        const putCommand = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key,
            Body: fs.readFileSync(testFile),
            ContentType: "text/plain"
        });

        console.log(`Attempting to upload to bucket: ${process.env.S3_BUCKET_NAME}, key: ${key}`);
        await s3Client.send(putCommand);
        console.log("Test upload successful!");

        fs.unlinkSync(testFile);
    } catch (error) {
        console.error("S3 Test Failed:", error);
        fs.unlinkSync(testFile);
    }
}

testS3();
