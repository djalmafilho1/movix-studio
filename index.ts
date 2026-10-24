import { config as loadEnv } from 'dotenv';
import { config, higgsfield } from '@higgsfield/client/v2';

loadEnv({ path: '.env.local', quiet: true });
config({ credentials: process.env.HF_CREDENTIALS });

async function main() {
  if (!process.env.HF_CREDENTIALS) {
    throw new Error('HF_CREDENTIALS não foi definido no arquivo .env.local');
  }

  const result = await higgsfield.subscribe(
    'bytedance/seedance-2.5/text-to-video',
    {
      input: {
        prompt: 'A cinematic scene at sunset',
        duration: 5,
        resolution: '720p',
        aspect_ratio: '16:9',
        output_format: 'mp4',
        generate_audio: true,
      },
      withPolling: true,
    },
  );

  if (!result.isCompleted) {
    throw new Error('A geração do vídeo não foi concluída.');
  }

  const videoUrl = result.jobs[0]?.results?.raw.url;
  if (!videoUrl) {
    throw new Error('Nenhuma URL de vídeo foi retornada.');
  }

  console.log(videoUrl);
}

void main().catch((error) => {
  console.error('Erro:', error);
  process.exitCode = 1;
});
