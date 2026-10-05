import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { PNG } from "pngjs";
import { db } from "./client.js";
import { nonograms } from "./schema.js";
function runLengths(cells) {
    const clues = [];
    let count = 0;
    for (const cell of cells) {
        if (cell === 1) {
            count++;
        }
        else if (count > 0) {
            clues.push(count);
            count = 0;
        }
    }
    if (count > 0)
        clues.push(count);
    return clues.length > 0 ? clues : [0];
}
function computeClues(solution, width, height) {
    const rowClues = [];
    for (let r = 0; r < height; r++) {
        rowClues.push(runLengths(solution.slice(r * width, (r + 1) * width)));
    }
    const colClues = [];
    for (let c = 0; c < width; c++) {
        const col = Array.from({ length: height }, (_, r) => solution[r * width + c]);
        colClues.push(runLengths(col));
    }
    return { rowClues, colClues };
}
export async function importPuzzles() {
    const imgsDir = path.join(process.cwd(), "imgs");
    const outlineDir = path.join(imgsDir, "outline");
    const colouredDir = path.join(imgsDir, "coloured");
    if (!fs.existsSync(outlineDir)) {
        console.warn("imgs/outline not found, skipping puzzle import");
        return;
    }
    for (const bwFile of fs.readdirSync(outlineDir).sort()) {
        if (!bwFile.endsWith(".png"))
            continue;
        const name = bwFile.replace(/^BW_/, "").replace(/\.png$/, "");
        const colFile = `Col_${name}.png`;
        const colPath = path.join(colouredDir, colFile);
        if (!fs.existsSync(colPath)) {
            console.warn(`No colour match for ${bwFile}, skipping`);
            continue;
        }
        const bwPng = PNG.sync.read(fs.readFileSync(path.join(outlineDir, bwFile)));
        const colPng = PNG.sync.read(fs.readFileSync(colPath));
        const { width, height } = bwPng;
        const solution = [];
        const colors = [];
        for (let i = 0; i < width * height; i++) {
            const base = i * 4;
            const lum = (bwPng.data[base] * 299 +
                bwPng.data[base + 1] * 587 +
                bwPng.data[base + 2] * 114) /
                1000;
            solution.push(lum < 128 ? 1 : 0);
            const r = colPng.data[base].toString(16).padStart(2, "0");
            const g = colPng.data[base + 1].toString(16).padStart(2, "0");
            const b = colPng.data[base + 2].toString(16).padStart(2, "0");
            colors.push(`#${r}${g}${b}`);
        }
        const { rowClues, colClues } = computeClues(solution, width, height);
        const id = createHash("sha256")
            .update(`${width}x${height}:${solution.join("")}`)
            .digest("hex");
        const inserted = await db
            .insert(nonograms)
            .values({ id, width, height, solution, rowClues, colClues, colors })
            .onConflictDoNothing()
            .returning({ id: nonograms.id });
        if (inserted.length > 0) {
            console.log(`Imported puzzle "${name}" (${id.slice(0, 8)}…)`);
        }
    }
}
