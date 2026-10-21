# MES Analytics Frontend

센서 파형, 에뮬레이터 설정, 모델 학습 화면입니다. 파형 화면은 가속도(g), 전압(V), 이동 RMS, FFT 윈도우, 축 고정을 고릅니다. 브라우저가 아니라 서버 액션이 수집기(8001), 에뮬레이터(8002), 분석 백엔드(8003)를 호출합니다.

```bash
npm install
cp .env.example .env
npm run dev -- --port 3001
```
