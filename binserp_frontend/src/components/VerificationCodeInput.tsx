"use client";

import { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent } from "react";

interface VerificationCodeInputProps {
    length?: number;
    onComplete: (code: string) => void;
    disabled?: boolean;
}

export default function VerificationCodeInput({
    length = 6,
    onComplete,
    disabled = false,
}: VerificationCodeInputProps) {
    const [code, setCode] = useState<string[]>(Array(length).fill(""));
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        // Focus first input on mount
        inputRefs.current[0]?.focus();
    }, []);

    const handleChange = (index: number, value: string) => {
        if (disabled) return;

        // Only allow numbers
        const newValue = value.replace(/[^0-9]/g, "");

        if (newValue.length > 1) {
            // Handle paste
            handlePaste(index, newValue);
            return;
        }

        const newCode = [...code];
        newCode[index] = newValue;
        setCode(newCode);

        // Move to next input
        if (newValue && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }

        // Check if code is complete
        if (newCode.every((digit) => digit !== "")) {
            onComplete(newCode.join(""));
        }
    };

    const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return;

        if (e.key === "Backspace" && !code[index] && index > 0) {
            // Move to previous input on backspace if current is empty
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === "ArrowLeft" && index > 0) {
            inputRefs.current[index - 1]?.focus();
        } else if (e.key === "ArrowRight" && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handlePaste = (startIndex: number, pastedData: string) => {
        const digits = pastedData.replace(/[^0-9]/g, "").split("");
        const newCode = [...code];

        digits.forEach((digit, i) => {
            const index = startIndex + i;
            if (index < length) {
                newCode[index] = digit;
            }
        });

        setCode(newCode);

        // Focus the next empty input or the last input
        const nextEmptyIndex = newCode.findIndex((digit) => digit === "");
        const focusIndex = nextEmptyIndex === -1 ? length - 1 : nextEmptyIndex;
        inputRefs.current[focusIndex]?.focus();

        // Check if code is complete
        if (newCode.every((digit) => digit !== "")) {
            onComplete(newCode.join(""));
        }
    };

    const handlePasteEvent = (e: ClipboardEvent<HTMLInputElement>, index: number) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text");
        handlePaste(index, pastedData);
    };

    return (
        <div className="flex justify-center gap-3">
            {code.map((digit, index) => (
                <input
                    key={index}
                    ref={(el) => {
                        inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={(e) => handlePasteEvent(e, index)}
                    disabled={disabled}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
            ))}
        </div>
    );
}
