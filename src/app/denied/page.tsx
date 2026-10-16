// 작업자가 센서 분석 주소로 들어왔을 때 보여주는 안내.
export default function DeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="max-w-md rounded-2xl border border-white/8 bg-[#12181f] p-6">
        <h1 className="text-xl font-semibold text-zinc-50">관리자만 볼 수 있습니다</h1>
        <p className="mt-2 text-sm text-zinc-400">센서 파형, 센서 연결, 모델 학습은 관리자 권한입니다.</p>
        <a className="mt-4 inline-block text-sm text-sky-300" href={process.env.MES_PUBLIC_URL ?? "https://localhost:13000"}>
          MES로 돌아가기
        </a>
      </section>
    </main>
  );
}
