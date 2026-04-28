"use client";

type ReferralCodeInputProps = {
  code: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  warning: string | null;
};

export default function ReferralCodeInput({
  code,
  onChange,
  warning,
}: ReferralCodeInputProps) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">
        Referral Code (optional)
      </label>
      <input
        type="text"
        value={code}
        onChange={onChange}
        placeholder="Enter referral code"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/40"
      />
      {warning && (
        <p className="mt-1.5 text-xs text-amber-400">
          {warning}
        </p>
      )}
    </div>
  );
}
