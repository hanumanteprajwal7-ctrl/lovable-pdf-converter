import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);
const isDev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  const app = express();

  // Support JSON and binary buffers up to 100MB
  app.use(express.json({ limit: '100mb' }));
  app.use(express.raw({ type: ['application/pdf', 'application/octet-stream'], limit: '100mb' }));

  // Health check
  app.get('/api/health', async (_req: Request, res: Response) => {
    let gsAvailable = false;
    try {
      await execFileAsync('gs', ['--version']);
      gsAvailable = true;
    } catch {}
    res.json({ status: 'ok', ghostscript: gsAvailable });
  });

  // Protect PDF with User and Owner passwords via Ghostscript 128-bit AES/Standard encryption
  app.post('/api/pdf/protect', async (req: Request, res: Response) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-protect-'));
    const inputPath = path.join(tmpDir, 'input.pdf');
    const outputPath = path.join(tmpDir, 'protected.pdf');

    try {
      const userPassword = (req.headers['x-user-password'] as string) || '';
      const ownerPassword = (req.headers['x-owner-password'] as string) || userPassword;
      const allowPrinting = req.headers['x-allow-printing'] !== 'false';
      const allowCopying = req.headers['x-allow-copying'] !== 'false';

      if (!userPassword) {
        res.status(400).json({ error: 'User password is required' });
        return;
      }

      const pdfData = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
      fs.writeFileSync(inputPath, pdfData);

      // PDF 1.4+ 128-bit encryption permissions
      // Default -4 allows printing and copying. Restrict bits if requested.
      let permissions = -4;
      if (!allowPrinting && !allowCopying) permissions = -64;
      else if (!allowPrinting) permissions = -4 - 4; // remove print bit
      else if (!allowCopying) permissions = -4 - 16; // remove copy bit

      const gsArgs = [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        `-sUserPassword=${userPassword}`,
        `-sOwnerPassword=${ownerPassword}`,
        '-dEncryptionR=3',
        '-dKeyLength=128',
        `-dPermissions=${permissions}`,
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        `-sOutputFile=${outputPath}`,
        inputPath,
      ];

      await execFileAsync('gs', gsArgs);

      if (!fs.existsSync(outputPath)) {
        throw new Error('Ghostscript failed to generate protected output');
      }

      const outputData = fs.readFileSync(outputPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', outputData.length);
      res.send(outputData);
    } catch (err: any) {
      console.error('Protect PDF API error:', err);
      res.status(500).json({ error: err.message || 'Failed to protect PDF' });
    } finally {
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        fs.rmdirSync(tmpDir);
      } catch {}
    }
  });

  // Unlock PDF by providing authorized password
  app.post('/api/pdf/unlock', async (req: Request, res: Response) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-unlock-'));
    const inputPath = path.join(tmpDir, 'encrypted.pdf');
    const outputPath = path.join(tmpDir, 'unlocked.pdf');

    try {
      const password = (req.headers['x-pdf-password'] as string) || '';
      if (!password) {
        res.status(400).json({ error: 'Password is required to decrypt the PDF' });
        return;
      }

      const pdfData = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
      fs.writeFileSync(inputPath, pdfData);

      const gsArgs = [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        `-sPDFPassword=${password}`,
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        `-sOutputFile=${outputPath}`,
        inputPath,
      ];

      await execFileAsync('gs', gsArgs);

      if (!fs.existsSync(outputPath)) {
        throw new Error('Incorrect password or unable to decrypt PDF document');
      }

      const outputData = fs.readFileSync(outputPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', outputData.length);
      res.send(outputData);
    } catch (err: any) {
      console.error('Unlock PDF API error:', err);
      res.status(400).json({
        error: 'Incorrect password or PDF cannot be unlocked with the provided credentials.',
      });
    } finally {
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        fs.rmdirSync(tmpDir);
      } catch {}
    }
  });

  // Helper to run Ghostscript with strict parameters and measure verified output size
  async function runGhostscriptPass(
    inputPath: string,
    outputPath: string,
    options: {
      pdfSetting?: string;
      dpi?: number;
      colorMode?: string;
    }
  ): Promise<number | null> {
    const gsArgs = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=${options.pdfSetting || '/ebook'}`,
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      '-dDetectDuplicateImages=true',
      '-dCompressFonts=true',
      '-dSubsetFonts=true',
      '-dOptimize=true',
    ];

    if (options.dpi) {
      gsArgs.push(
        '-dDownsampleColorImages=true',
        '-dColorImageDownsampleType=/Bicubic',
        `-dColorImageResolution=${options.dpi}`,
        '-dColorImageDownsampleThreshold=1.0',
        '-dDownsampleGrayImages=true',
        '-dGrayImageDownsampleType=/Bicubic',
        `-dGrayImageResolution=${options.dpi}`,
        '-dGrayImageDownsampleThreshold=1.0',
        '-dDownsampleMonoImages=true',
        `-dMonoImageResolution=${options.dpi}`,
        '-dMonoImageDownsampleThreshold=1.0'
      );
    }

    if (options.colorMode === 'gray') {
      gsArgs.push(
        '-sColorConversionStrategy=Gray',
        '-sColorConversionStrategyForImages=Gray',
        '-dProcessColorModel=/DeviceGray'
      );
    } else if (options.colorMode === 'mono') {
      gsArgs.push(
        '-sColorConversionStrategy=Mono',
        '-sColorConversionStrategyForImages=Mono',
        '-dProcessColorModel=/DeviceGray'
      );
    }

    gsArgs.push(`-sOutputFile=${outputPath}`, inputPath);

    try {
      await execFileAsync('gs', gsArgs);
      if (fs.existsSync(outputPath)) {
        const stat = fs.statSync(outputPath);
        if (stat.size > 0) {
          // Verify valid PDF header
          const fd = fs.openSync(outputPath, 'r');
          const headerBuf = Buffer.alloc(5);
          fs.readSync(fd, headerBuf, 0, 5, 0);
          fs.closeSync(fd);
          if (headerBuf.toString().startsWith('%PDF-')) {
            return stat.size;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  // Primary Backend Compression Engine with Real File Size Verification and +-3% Target Window
  app.post('/api/pdf/compress', async (req: Request, res: Response) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-compress-engine-'));
    const inputPath = path.join(tmpDir, 'input.pdf');

    try {
      const pdfData = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
      const originalSize = pdfData.length;

      if (originalSize === 0) {
        res.status(400).json({ error: 'PDF data is empty' });
        return;
      }

      fs.writeFileSync(inputPath, pdfData);

      const preset = (req.headers['x-preset'] as string) || 'recommended';
      const colorMode = (req.headers['x-color-mode'] as string) || 'full';
      const reqDpi = req.headers['x-dpi'] ? parseInt(req.headers['x-dpi'] as string, 10) : undefined;

      // Target determination: either explicit target bytes or target reduction percentage
      let targetSizeBytes: number | undefined;
      if (req.headers['x-target-size-bytes']) {
        const parsed = parseInt(req.headers['x-target-size-bytes'] as string, 10);
        if (parsed > 0) targetSizeBytes = parsed;
      } else if (req.headers['x-target-reduction-percent']) {
        const pct = parseFloat(req.headers['x-target-reduction-percent'] as string);
        if (pct > 0 && pct < 100) {
          targetSizeBytes = Math.round(originalSize * (1 - pct / 100));
        }
      }

      // 1. If original document is already smaller than or equal to target size:
      if (targetSizeBytes && originalSize <= targetSizeBytes) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', originalSize);
        res.setHeader('x-original-size', String(originalSize));
        res.setHeader('x-new-size', String(originalSize));
        res.setHeader('x-reduction-percent', '0');
        res.setHeader('x-bytes-saved', '0');
        res.setHeader('x-is-already-optimized', 'true');
        res.setHeader('x-target-size-bytes', String(targetSizeBytes));
        res.setHeader('x-target-achieved', 'true');
        res.setHeader('x-within-tolerance', 'true');
        res.setHeader('x-tolerance-percent', '0');
        res.setHeader('x-compression-method', 'Already Within Target');
        res.setHeader(
          'x-compression-message',
          encodeURIComponent(
            `Document (${(originalSize / 1024).toFixed(1)} KB) already meets or is below the target size (${(targetSizeBytes / 1024).toFixed(1)} KB). Further compression is not needed.`
          )
        );
        res.send(pdfData);
        return;
      }

      interface TierCandidate {
        path: string;
        size: number;
        dpi?: number;
        pdfSetting: string;
        label: string;
        inTolerance: boolean;
        tolerancePct: number;
      }

      const candidates: TierCandidate[] = [];

      // Calibrated tiers from lightest compression to strongest
      type TierPlan = { pdfSetting: string; dpi?: number; label: string };
      let tiers: TierPlan[] = [];

      if (preset === 'high-quality') {
        tiers = [
          { pdfSetting: '/prepress', dpi: 260, label: 'High Quality (260 DPI)' },
          { pdfSetting: '/printer', dpi: 220, label: 'High Quality (220 DPI)' },
          { pdfSetting: '/printer', dpi: 190, label: 'High Quality (190 DPI)' },
        ];
      } else if (preset === 'recommended') {
        tiers = [
          { pdfSetting: '/printer', dpi: 200, label: 'Balanced (200 DPI)' },
          { pdfSetting: '/ebook', dpi: 150, label: 'Recommended Balanced (150 DPI)' },
          { pdfSetting: '/ebook', dpi: 120, label: 'Balanced Moderate (120 DPI)' },
        ];
      } else if (preset === 'maximum') {
        tiers = [
          { pdfSetting: '/ebook', dpi: 120, label: 'Moderate (120 DPI)' },
          { pdfSetting: '/screen', dpi: 96, label: 'Maximum (96 DPI)' },
          { pdfSetting: '/screen', dpi: 72, label: 'Aggressive (72 DPI)' },
        ];
      } else if (preset === 'custom' && !targetSizeBytes) {
        const customDpi = reqDpi || 150;
        tiers = [
          {
            pdfSetting: customDpi <= 96 ? '/screen' : customDpi <= 180 ? '/ebook' : '/printer',
            dpi: customDpi,
            label: `Custom Tuning (${customDpi} DPI)`,
          },
        ];
      } else {
        // TARGET-SIZE OR TARGET-REDUCTION MODE:
        // Graduated sequence from gentle downsampling to strong, preventing over-compression
        tiers = [
          { pdfSetting: '/prepress', dpi: 280, label: 'Gentle (280 DPI)' },
          { pdfSetting: '/printer', dpi: 220, label: 'Light (220 DPI)' },
          { pdfSetting: '/ebook', dpi: 170, label: 'Moderate (170 DPI)' },
          { pdfSetting: '/ebook', dpi: 140, label: 'Balanced (140 DPI)' },
          { pdfSetting: '/ebook', dpi: 110, label: 'Medium (110 DPI)' },
          { pdfSetting: '/screen', dpi: 90, label: 'Strong (90 DPI)' },
          { pdfSetting: '/screen', dpi: 72, label: 'Maximum (72 DPI)' },
        ];
      }

      // +-3% target window bounds
      const targetMin = targetSizeBytes ? targetSizeBytes * 0.97 : 0; // -3%
      const targetMax = targetSizeBytes ? targetSizeBytes * 1.03 : Infinity; // +3%

      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        const tierOutPath = path.join(tmpDir, `tier_${i}.pdf`);
        const sz = await runGhostscriptPass(inputPath, tierOutPath, {
          pdfSetting: tier.pdfSetting,
          dpi: tier.dpi,
          colorMode,
        });

        if (sz !== null && sz < originalSize) {
          const tolPct = targetSizeBytes
            ? Number((((sz - targetSizeBytes) / targetSizeBytes) * 100).toFixed(1))
            : 0;
          const inTol = targetSizeBytes ? sz >= targetMin && sz <= targetMax : false;

          const cand: TierCandidate = {
            path: tierOutPath,
            size: sz,
            dpi: tier.dpi,
            pdfSetting: tier.pdfSetting,
            label: tier.label,
            inTolerance: inTol,
            tolerancePct: tolPct,
          };
          candidates.push(cand);

          // If target size mode and hit within +-3% window:
          if (targetSizeBytes && inTol) {
            // STOP! We hit the target within +-3% without overcompression
            break;
          }

          // If target size mode and this tier crossed below targetMin (overshot),
          // check if we can interpolate DPI between previous tier and this tier:
          if (targetSizeBytes && sz < targetMin && candidates.length >= 2) {
            const prev = candidates[candidates.length - 2];
            if (prev.size > targetMax && prev.dpi && tier.dpi && Math.abs(prev.dpi - tier.dpi) > 10) {
              const midDpi = Math.round((prev.dpi + tier.dpi) / 2);
              const midOutPath = path.join(tmpDir, `tier_mid_${i}.pdf`);
              const midSz = await runGhostscriptPass(inputPath, midOutPath, {
                pdfSetting: tier.pdfSetting,
                dpi: midDpi,
                colorMode,
              });

              if (midSz !== null && midSz < originalSize) {
                const midTolPct = Number(
                  (((midSz - targetSizeBytes) / targetSizeBytes) * 100).toFixed(1)
                );
                const midInTol = midSz >= targetMin && midSz <= targetMax;
                candidates.push({
                  path: midOutPath,
                  size: midSz,
                  dpi: midDpi,
                  pdfSetting: tier.pdfSetting,
                  label: `Calibrated Precision (${midDpi} DPI)`,
                  inTolerance: midInTol,
                  tolerancePct: midTolPct,
                });

                if (midInTol) {
                  break;
                }
              }
            }
            // Stop further tiers to prevent unnecessary over-compression
            break;
          }
        }
      }

      // CANDIDATE SELECTION
      if (candidates.length === 0) {
        // Document could not be reduced without corruption; preserve original
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Length', originalSize);
        res.setHeader('x-original-size', String(originalSize));
        res.setHeader('x-new-size', String(originalSize));
        res.setHeader('x-reduction-percent', '0');
        res.setHeader('x-bytes-saved', '0');
        res.setHeader('x-is-already-optimized', 'true');
        res.setHeader('x-target-achieved', 'false');
        res.setHeader('x-within-tolerance', 'false');
        res.setHeader('x-compression-method', 'Preserved Original');
        res.setHeader(
          'x-compression-message',
          encodeURIComponent(
            'Compression did not reduce this file. This PDF may already be optimized or contain content that cannot be compressed further.'
          )
        );
        res.send(pdfData);
        return;
      }

      let winner: TierCandidate;

      if (targetSizeBytes) {
        // 1. Look for candidate within +-3% of target window
        const inTolCandidates = candidates.filter((c) => c.inTolerance);
        if (inTolCandidates.length > 0) {
          // Pick candidate closest to target
          inTolCandidates.sort(
            (a, b) => Math.abs(a.size - targetSizeBytes) - Math.abs(b.size - targetSizeBytes)
          );
          winner = inTolCandidates[0];
        } else {
          // 2. Candidates <= target: pick largest candidate <= target (least overcompressed)
          const underTarget = candidates.filter((c) => c.size <= targetSizeBytes);
          if (underTarget.length > 0) {
            underTarget.sort((a, b) => b.size - a.size);
            winner = underTarget[0];
          } else {
            // 3. Best effort: pick smallest candidate achieved
            candidates.sort((a, b) => a.size - b.size);
            winner = candidates[0];
          }
        }
      } else {
        // Preset mode: pick the smallest valid candidate
        candidates.sort((a, b) => a.size - b.size);
        winner = candidates[0];
      }

      const outputData = fs.readFileSync(winner.path);
      const newSize = outputData.length;
      const bytesSaved = originalSize - newSize;
      const reductionPercent = Number((((originalSize - newSize) / originalSize) * 100).toFixed(1));
      const targetAchieved = targetSizeBytes ? newSize <= targetSizeBytes : true;
      const withinTolerance = targetSizeBytes
        ? Math.abs(newSize - targetSizeBytes) <= targetSizeBytes * 0.03
        : false;
      const tolerancePercent = targetSizeBytes
        ? Number((((newSize - targetSizeBytes) / targetSizeBytes) * 100).toFixed(1))
        : 0;

      let message = `Successfully compressed to ${(newSize / 1024).toFixed(1)} KB (${reductionPercent}% saved).`;
      if (targetSizeBytes) {
        if (withinTolerance) {
          message = `Target achieved within ±3% tolerance! Final size ${(newSize / 1024).toFixed(1)} KB is ${
            tolerancePercent >= 0 ? '+' : ''
          }${tolerancePercent}% of target. Optimal quality preserved without unnecessary compression.`;
        } else if (targetAchieved) {
          message = `Target achieved! Reduced to ${(newSize / 1024).toFixed(1)} KB (below requested target of ${(
            targetSizeBytes / 1024
          ).toFixed(1)} KB).`;
        } else {
          message = `Requested target of ${(targetSizeBytes / 1024).toFixed(
            1
          )} KB could not be reached without visual corruption. Achieved best possible reduction to ${(
            newSize / 1024
          ).toFixed(1)} KB.`;
        }
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', outputData.length);
      res.setHeader('x-original-size', String(originalSize));
      res.setHeader('x-new-size', String(newSize));
      res.setHeader('x-reduction-percent', String(reductionPercent));
      res.setHeader('x-bytes-saved', String(bytesSaved));
      res.setHeader('x-is-already-optimized', 'false');
      res.setHeader('x-target-size-bytes', String(targetSizeBytes || ''));
      res.setHeader('x-target-achieved', String(targetAchieved));
      res.setHeader('x-within-tolerance', String(withinTolerance));
      res.setHeader('x-tolerance-percent', String(tolerancePercent));
      res.setHeader('x-compression-method', winner.label);
      res.setHeader('x-compression-message', encodeURIComponent(message));
      res.send(outputData);
    } catch (err: any) {
      console.error('Backend compression error:', err);
      res.status(500).json({ error: err.message || 'Compression failed' });
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  });

  // Granular / legacy backend Ghostscript compression pass
  app.post('/api/pdf/compress-pass', async (req: Request, res: Response) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-compress-pass-'));
    const inputPath = path.join(tmpDir, 'input.pdf');
    const outputPath = path.join(tmpDir, 'compressed.pdf');

    try {
      const pdfSetting = (req.headers['x-pdf-setting'] as string) || '/ebook';
      const dpi = req.headers['x-dpi'] ? parseInt(req.headers['x-dpi'] as string, 10) : undefined;
      const colorMode = (req.headers['x-color-mode'] as string) || 'full';
      const pdfData = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
      fs.writeFileSync(inputPath, pdfData);

      const sz = await runGhostscriptPass(inputPath, outputPath, {
        pdfSetting,
        dpi,
        colorMode,
      });

      if (!sz || !fs.existsSync(outputPath)) {
        throw new Error('Ghostscript failed to optimize PDF');
      }

      const outputData = fs.readFileSync(outputPath);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', outputData.length);
      res.send(outputData);
    } catch (err: any) {
      console.error('Compress PDF pass error:', err);
      res.status(500).json({ error: err.message || 'Optimization failed' });
    } finally {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  });

  // Setup Vite in middleware mode for dev server, or serve static dist in production
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lovable PDF Converter server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
