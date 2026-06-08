import {
  PutObjectCommand,
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const R2_PREFIX = "aretay";

function getR2Config() {
  const endpoint = process.env.R2_ENDPOINT_URL;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME ?? "click-dataset";

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 env vars missing: R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY");
  }

  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

function getClient() {
  const { endpoint, accessKeyId, secretAccessKey } = getR2Config();
  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export function lessonVideoKey(courseId: string, lessonId: number) {
  return `${R2_PREFIX}/courses/${courseId}/lessons/${lessonId}.mp4`;
}

export async function uploadVideo(key: string, body: Buffer) {
  const { bucket } = getR2Config();
  const client = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: "video/mp4",
    }),
  );
}

export async function objectExists(key: string): Promise<boolean> {
  const { bucket } = getR2Config();
  const client = getClient();

  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function getVideoUrl(key: string, expiresIn = 60 * 60 * 24 * 7) {
  const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (publicBase) {
    return `${publicBase}/${key}`;
  }

  const { bucket } = getR2Config();
  const client = getClient();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}
