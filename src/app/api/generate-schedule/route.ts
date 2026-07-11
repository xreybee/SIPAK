import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

function chunkBeban(beban: number): number[] {
  // Minimal 2 jam berturut-turut, maksimal 3 jam berturut-turut
  if (beban === 6) return [3, 3]; // Perbaikan: hanya jika beban tepat 6
  if (beban === 5) return [3, 2];
  if (beban === 4) return [2, 2];
  if (beban === 3) return [3];
  if (beban === 2) return [2];
  if (beban === 1) return [1];
  
  let chunks = [];
  let remaining = beban;
  while(remaining > 0) {
    if (remaining >= 3) {
      chunks.push(3);
      remaining -= 3;
    } else {
      chunks.push(remaining);
      remaining = 0;
    }
  }
  return chunks;
}

export async function POST() {
  try {
    const [guruRes, mapelRes, kelasRes, bebanRes, unavailableRes] = await Promise.all([
      supabase.from('guru').select('*'),
      supabase.from('mata_pelajaran').select('*'),
      supabase.from('kelas').select('*'),
      supabase.from('beban_mengajar').select('*'),
      supabase.from('guru_unavailable').select('*')
    ]);

    if (!guruRes.data || !mapelRes.data || !kelasRes.data || !bebanRes.data) {
      throw new Error("Failed to fetch data master");
    }

    const guruUnavailableMap: Record<string, Record<number, Record<number, boolean>>> = {};
    if (unavailableRes.data) {
      unavailableRes.data.forEach(u => {
        if (!guruUnavailableMap[u.id_guru]) guruUnavailableMap[u.id_guru] = {};
        if (!guruUnavailableMap[u.id_guru][u.hari]) guruUnavailableMap[u.id_guru][u.hari] = {};
        // If jam_ke is null, block the whole day (1 to 8)
        if (u.jam_ke === null) {
          for(let p = 1; p <= 8; p++) guruUnavailableMap[u.id_guru][u.hari][p] = true;
        } else {
          guruUnavailableMap[u.id_guru][u.hari][u.jam_ke] = true;
        }
      });
    }

    await supabase.from('jadwal_aktif').delete().neq('id_jadwal', '00000000-0000-0000-0000-000000000000');

    const mapelDict: Record<string, any> = {};
    mapelRes.data.forEach(m => mapelDict[m.id_mapel] = m);

    interface ScheduleTask {
      id_guru: string;
      id_mapel: string;
      id_kelas: string;
      length: number;
      baseSlack: number; // Tambahkan properti ini
      isFallback?: boolean;
    }
    let tasks: ScheduleTask[] = [];

    bebanRes.data.forEach(b => {
      const bebanJam = mapelDict[b.id_mapel]?.beban_jam || 2;
      const blocks = chunkBeban(bebanJam);
      blocks.forEach(len => {
        tasks.push({
          id_guru: b.id_guru,
          id_mapel: b.id_mapel,
          id_kelas: b.id_kelas,
          length: len,
          baseSlack: 0 // Inisialisasi baseSlack
        });
      });
    });

    if (tasks.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data relasi beban mengajar. Silakan atur di Panel Data Induk.' }, { status: 400 });
    }

    const validPeriodsMap: Record<number, number[]> = {
      1: [3, 4, 5, 6, 7, 8],       // Senin (6 jam)
      2: [1, 2, 3, 4, 5, 6, 7, 8], // Selasa (8 jam)
      3: [1, 2, 3, 4, 5, 6, 7, 8], // Rabu (8 jam)
      4: [1, 2, 3, 4, 5, 6, 7, 8], // Kamis (8 jam)
      5: [1, 2, 3, 4],             // Jumat (4 jam)
      6: [1, 2, 3, 4, 5, 6, 7]     // Sabtu (7 jam)
    };

    const teacherLoad: Record<string, number> = {};
    const classLoad: Record<string, number> = {};
    
    tasks.forEach(t => {
      teacherLoad[t.id_guru] = (teacherLoad[t.id_guru] || 0) + t.length;
      classLoad[t.id_kelas] = (classLoad[t.id_kelas] || 0) + t.length;
    });

    for (const id_kelas in classLoad) {
      if (classLoad[id_kelas] > 41) {
        const kName = kelasRes.data.find(k => k.id_kelas === id_kelas);
        return NextResponse.json({ error: `MATEMATIS MUSTAHIL: Kelas ${kName?.tingkat} ${kName?.nama_kelompok} memiliki beban mapel (${classLoad[id_kelas]} jam) melebihi kapasitas maksimal mingguan sekolah (41 jam).` }, { status: 400 });
      }
    }

    const guruUnavailableMapCount: Record<string, number> = {};

    for (const id_guru in teacherLoad) {
      let unavailableCount = 0;
      if (guruUnavailableMap[id_guru]) {
        for (const d in guruUnavailableMap[id_guru]) {
          for (const p in guruUnavailableMap[id_guru][d]) {
            const day = parseInt(d);
            const period = parseInt(p);
            if (validPeriodsMap[day]?.includes(period)) {
              unavailableCount++;
            }
          }
        }
      }
      guruUnavailableMapCount[id_guru] = unavailableCount;
      const maxAvailable = 41 - unavailableCount;
      if (teacherLoad[id_guru] > maxAvailable) {
        const gName = guruRes.data.find(g => g.id_guru === id_guru)?.nama;
        return NextResponse.json({ error: `MATEMATIS MUSTAHIL: Guru ${gName} harus mengajar ${teacherLoad[id_guru]} jam, tetapi hanya memiliki ${maxAvailable} jam kosong (karena aturan libur/izin).` }, { status: 400 });
      }
    }

    let bestUnassignedCount = Infinity;
    let bestFinalSchedules: any[] = [];
    let bestUnassignedTasks: any[] = [];

    const MAX_RETRIES = 40000;
    const startTime = Date.now();
    const MAX_TIME_MS = 8000; // 8-second safety timeout

    // Precalculate base slack
    tasks.forEach(t => {
      t.baseSlack = (41 - (guruUnavailableMapCount[t.id_guru] || 0) - teacherLoad[t.id_guru]) + (41 - classLoad[t.id_kelas]);
    });

    // Pre-generate shuffled day arrays to avoid high allocation/GC overhead inside the loop
    const PRESHUFFLED_DAYS: number[][] = [];
    for (let i = 0; i < 120; i++) {
      PRESHUFFLED_DAYS.push(shuffleArray([1, 2, 3, 4, 5, 6]));
    }

    for (let iter = 0; iter < MAX_RETRIES; iter++) {
      // Check execution time budget every 100 iterations
      if (iter % 100 === 0 && Date.now() - startTime > MAX_TIME_MS) {
        console.log(`Broke out of generate loop early at iteration ${iter} due to timeout`);
        break;
      }

      const teacherSchedule: Record<string, Record<number, Record<number, boolean>>> = {};
      const classSchedule: Record<string, Record<number, Record<number, boolean>>> = {};
      const classMapelHours: Record<string, Record<string, Record<number, number>>> = {};
      const classTeacherHours: Record<string, Record<string, Record<number, number>>> = {};
      const finalSchedules: any[] = [];
      let unassignedCount = 0;
      const unassignedTasksList: any[] = [];

      // Shuffle tasks to create variation
      const shuffledTasks = shuffleArray([...tasks]);
      
      // Sort tasks using a stable method with precalculated random jitter
      // This prevents the sorting comparator from violating transitivity/stability constraints
      const tasksWithJitter = shuffledTasks.map(t => ({
        task: t,
        effectiveSlack: t.baseSlack + (Math.random() * 4 - 2),
        effectiveLen: t.length + (Math.random() * 1.5)
      }));

      tasksWithJitter.sort((a, b) => {
        if (Math.abs(a.effectiveSlack - b.effectiveSlack) > 1.5) {
          return a.effectiveSlack - b.effectiveSlack;
        }
        return b.effectiveLen - a.effectiveLen;
      });

      const iterationTasks = tasksWithJitter.map(x => x.task);

      for (let i = 0; i < iterationTasks.length; i++) {
        const task = iterationTasks[i];
        let assigned = false;
        const { id_guru, id_mapel, id_kelas, length: N, isFallback } = task;
      
        if (!teacherSchedule[id_guru]) teacherSchedule[id_guru] = {};
        if (!classSchedule[id_kelas]) classSchedule[id_kelas] = {};
        if (!classMapelHours[id_kelas]) classMapelHours[id_kelas] = {};
        if (!classMapelHours[id_kelas][id_mapel]) classMapelHours[id_kelas][id_mapel] = {};
        if (!classTeacherHours[id_kelas]) classTeacherHours[id_kelas] = {};
        if (!classTeacherHours[id_kelas][id_guru]) classTeacherHours[id_kelas][id_guru] = {};

        // Pick a pre-shuffled day order randomly to avoid GC allocation overhead
        const days = PRESHUFFLED_DAYS[Math.floor(Math.random() * PRESHUFFLED_DAYS.length)];

        for (const d of days) {
          // PREVENT SAME SUBJECT MULTIPLE TIMES A DAY
          const currentHoursOnDay = classMapelHours[id_kelas][id_mapel][d] || 0;
          if (!isFallback && currentHoursOnDay > 0) continue;
          if (currentHoursOnDay + N > (isFallback ? 4 : 3)) continue; 

          // PREVENT > 3 hours per teacher per class per day
          const currentTeacherHoursOnDay = classTeacherHours[id_kelas][id_guru][d] || 0;
          if (currentTeacherHoursOnDay + N > (isFallback ? 5 : 4)) continue;

          const available = validPeriodsMap[d];
          if (available.length < N) continue;

          // Try starting periods in a randomized wrap-around order
          const startLimit = available.length - N + 1;
          const startOffset = Math.floor(Math.random() * startLimit);

          for (let offset = 0; offset < startLimit; offset++) {
            const idx = (startOffset + offset) % startLimit;
            let isFree = true;
            for (let j = 0; j < N; j++) {
              const p = available[idx + j];
              if (
                teacherSchedule[id_guru][d]?.[p] || 
                classSchedule[id_kelas][d]?.[p] ||
                guruUnavailableMap[id_guru]?.[d]?.[p]
              ) {
                isFree = false;
                break;
              }
            }

            if (isFree) {
              const sp = available[idx];
              if (!teacherSchedule[id_guru][d]) teacherSchedule[id_guru][d] = {};
              if (!classSchedule[id_kelas][d]) classSchedule[id_kelas][d] = {};

              classMapelHours[id_kelas][id_mapel][d] = (classMapelHours[id_kelas][id_mapel][d] || 0) + N;
              classTeacherHours[id_kelas][id_guru][d] = (classTeacherHours[id_kelas][id_guru][d] || 0) + N;

              for (let j = 0; j < N; j++) {
                const p = sp + j;
                teacherSchedule[id_guru][d][p] = true;
                classSchedule[id_kelas][d][p] = true;
                finalSchedules.push({
                  id_guru: id_guru,
                  id_mapel: id_mapel,
                  id_kelas: id_kelas,
                  hari: d,
                  jam_ke: p
                });
              }
              assigned = true;
              break;
            }
          }
          if (assigned) break;
        }

        if (!assigned) {
          const mName = mapelDict[id_mapel]?.nama_mapel?.toLowerCase() || '';
          const isPjok = mName.includes('pjok') || mName.includes('jasmani') || mName.includes('olahraga');

          if (N > 1 && !isPjok) {
            // Fallback: split into N-1 and 1
            iterationTasks.splice(i + 1, 0,
              { id_guru, id_mapel, id_kelas, length: N - 1, isFallback: true, baseSlack: 0 },
              { id_guru, id_mapel, id_kelas, length: 1, isFallback: true, baseSlack: 0 }
            );
          } else if (!isFallback) {
            // Retry N but with fallback flag to relax constraints
            iterationTasks.splice(i + 1, 0, { id_guru, id_mapel, id_kelas, length: N, isFallback: true, baseSlack: 0 });
          } else {
            unassignedCount += N; // count as N hours failing
            unassignedTasksList.push(task);
          }
        }
      }

      if (unassignedCount < bestUnassignedCount) {
        bestUnassignedCount = unassignedCount;
        bestFinalSchedules = finalSchedules;
        bestUnassignedTasks = unassignedTasksList;
      }

      if (bestUnassignedCount === 0) break; // Perfect schedule found
    }

    // POST-PROCESSING REPAIR HEURISTIC (Slot-Swapping with strict constraint checks)
    if (bestUnassignedCount > 0) {
      let resolvedCount = 0;
      
      for (let fIdx = bestUnassignedTasks.length - 1; fIdx >= 0; fIdx--) {
        const task = bestUnassignedTasks[fIdx];
        if (task.length !== 1) continue;

        const { id_guru, id_mapel, id_kelas } = task;

        // Find empty slots for this class
        const emptySlots: { day: number; period: number }[] = [];
        for (const dStr in validPeriodsMap) {
          const d = parseInt(dStr);
          for (const p of validPeriodsMap[d]) {
            let classHasLesson = false;
            for (const item of bestFinalSchedules) {
              if (item.id_kelas === id_kelas && item.hari === d && item.jam_ke === p) {
                classHasLesson = true;
                break;
              }
            }
            if (!classHasLesson) {
              emptySlots.push({ day: d, period: p });
            }
          }
        }

        if (emptySlots.length === 0) continue;

        let swapSuccess = false;

        // Try to swap with scheduled lessons in this class
        for (const dStr in validPeriodsMap) {
          const d_swap = parseInt(dStr);
          for (const p_swap of validPeriodsMap[d_swap]) {
            let currentLessonIdx = -1;
            for (let idx = 0; idx < bestFinalSchedules.length; idx++) {
              const item = bestFinalSchedules[idx];
              if (item.id_kelas === id_kelas && item.hari === d_swap && item.jam_ke === p_swap) {
                currentLessonIdx = idx;
                break;
              }
            }

            if (currentLessonIdx === -1) continue;

            const t2_lesson = bestFinalSchedules[currentLessonIdx];
            const t2_guru = t2_lesson.id_guru;
            const t2_mapel = t2_lesson.id_mapel;

            if (t2_guru === id_guru || t2_mapel === id_mapel) continue;

            for (const emptySlot of emptySlots) {
              const d_empty = emptySlot.day;
              const p_empty = emptySlot.period;

              // Check if T is free at (d_swap, p_swap)
              let isTFreeAtSwap = !guruUnavailableMap[id_guru]?.[d_swap]?.[p_swap];
              if (isTFreeAtSwap) {
                for (const item of bestFinalSchedules) {
                  if (item.id_guru === id_guru && item.hari === d_swap && item.jam_ke === p_swap) {
                    isTFreeAtSwap = false;
                    break;
                  }
                }
              }

              // Check if T2 is free at (d_empty, p_empty)
              let isT2FreeAtEmpty = !guruUnavailableMap[t2_guru]?.[d_empty]?.[p_empty];
              if (isT2FreeAtEmpty) {
                for (const item of bestFinalSchedules) {
                  if (item.id_guru === t2_guru && item.hari === d_empty && item.jam_ke === p_empty) {
                    isT2FreeAtEmpty = false;
                    break;
                  }
                }
              }

              if (!isTFreeAtSwap || !isT2FreeAtEmpty) continue;

              // Check same-subject same-day limits
              let isTSubjectAlreadyOnDaySwap = false;
              for (const item of bestFinalSchedules) {
                if (item.id_kelas === id_kelas && item.id_mapel === id_mapel && item.hari === d_swap) {
                  isTSubjectAlreadyOnDaySwap = true;
                  break;
                }
              }

              let isT2SubjectAlreadyOnDayEmpty = false;
              for (const item of bestFinalSchedules) {
                if (item !== t2_lesson && item.id_kelas === id_kelas && item.id_mapel === t2_mapel && item.hari === d_empty) {
                  isT2SubjectAlreadyOnDayEmpty = true;
                  break;
                }
              }

              if (isTSubjectAlreadyOnDaySwap || isT2SubjectAlreadyOnDayEmpty) continue;

              // Check daily teacher load limit per class (max 4 hours)
              let tLoadOnDaySwap = 0;
              for (const item of bestFinalSchedules) {
                if (item.id_guru === id_guru && item.id_kelas === id_kelas && item.hari === d_swap) {
                  tLoadOnDaySwap++;
                }
              }

              let t2LoadOnDayEmpty = 0;
              for (const item of bestFinalSchedules) {
                if (item.id_guru === t2_guru && item.id_kelas === id_kelas && item.hari === d_empty) {
                  t2LoadOnDayEmpty++;
                }
              }

              if (tLoadOnDaySwap + 1 > 4 || t2LoadOnDayEmpty + 1 > 4) continue;

              // Perform the swap!
              t2_lesson.hari = d_empty;
              t2_lesson.jam_ke = p_empty;

              bestFinalSchedules.push({
                id_guru: id_guru,
                id_mapel: id_mapel,
                id_kelas: id_kelas,
                hari: d_swap,
                jam_ke: p_swap
              });

              swapSuccess = true;
              resolvedCount++;
              bestUnassignedTasks.splice(fIdx, 1);
              break;
            }
            if (swapSuccess) break;
          }
          if (swapSuccess) break;
        }
      }
      bestUnassignedCount -= resolvedCount;
    }

  if (bestFinalSchedules.length > 0) {
    const { error: insertError } = await supabase.from('jadwal_aktif').insert(bestFinalSchedules);
    if (insertError) throw insertError;
  }

    if (bestUnassignedCount > 0) {
      const failedDetails = bestUnassignedTasks.map(t => {
        const gName = guruRes.data.find(g => g.id_guru === t.id_guru)?.nama || 'Unknown';
        const kObj = kelasRes.data.find(k => k.id_kelas === t.id_kelas);
        const mName = mapelDict[t.id_mapel]?.nama_mapel || 'Unknown';
        return `${gName} (${mName} ${t.length} jam) di Kls ${kObj?.tingkat}${kObj?.nama_kelompok}`;
      }).join(', ');
      
      return NextResponse.json({ 
        message: `Sebagian jadwal digenerate, tetapi ada ${bestUnassignedCount} jam gagal dialokasikan. Detail Gagal: ${failedDetails}.` 
      });
    }

    return NextResponse.json({ message: 'Seluruh matriks jadwal berhasil digenerate sempurna!', total: bestFinalSchedules.length });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message || 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
