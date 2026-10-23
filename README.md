# MES Analytics Frontend

센서 파형, 파형 이력, 에뮬레이터 설정, 모델 학습 화면입니다. 실시간 파형은 최신 블록을 가속도(g), 전압(V), 이동 RMS, FFT 진폭, Welch PSD, 축 고정으로 봅니다. 이력에서 고른 블록은 학습 세트로 저장합니다. 브라우저가 아니라 서버 액션이 수집기(8001), 에뮬레이터(8002), 분석 백엔드(8003)를 호출합니다.

```bash
npm install
cp .env.example .env
npm run dev -- --port 3001
```
