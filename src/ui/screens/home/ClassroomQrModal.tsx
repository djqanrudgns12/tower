import { useMemo, useState } from 'react';
import { buildClassroomShareUrl, detectInAppBrowser } from '../../../application/entryUrl';
import { isGradeAvailable } from '../../../content';
import { DIFFICULTY_IDS, type DifficultyId } from '../../../contracts/balance';
import { DIFFICULTY_COPY, HOME_COPY } from '../../copy';
import { Button, Card, Modal, Segmented, type SegmentOption } from '../../kit';
import { LineIcon } from '../../icons/LineIcon';
import { canEncodeQr, encodeQrMatrix, qrMatrixToSvgPath } from '../../utils/qr';
import css from './home.module.css';
import qrCss from './ClassroomQrModal.module.css';

const GRADES = [3, 4, 5, 6] as const;
type Grade = (typeof GRADES)[number];
type DifficultyPreset = 'none' | DifficultyId;

interface Props {
  defaultGrade: Grade;
  onClose(): void;
}

async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 클립보드 권한이 제한된 웹뷰에서는 아래 execCommand 폴백을 시도한다.
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', 'true');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function ClassroomQrModal({ defaultGrade, onClose }: Props) {
  const initialGrade: Grade = isGradeAvailable(defaultGrade) ? defaultGrade : 3;

  const [grade, setGrade] = useState<Grade>(initialGrade);
  const [difficulty, setDifficulty] = useState<DifficultyPreset>('none');
  const [projectorMode, setProjectorMode] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const shareUrl = useMemo(
    () => buildClassroomShareUrl({ grade, ...(difficulty !== 'none' ? { difficulty } : {}) }),
    [grade, difficulty],
  );

  const qr = useMemo(() => {
    try {
      if (!canEncodeQr(shareUrl)) {
        return { hint: '주소가 길어 QR을 만들 수 없어요. 주소를 복사해 나눠 주세요.' };
      }
      return { svg: qrMatrixToSvgPath(encodeQrMatrix(shareUrl), 4) };
    } catch {
      return { hint: 'QR을 만들 수 없어요. 주소를 복사해 나눠 주세요.' };
    }
  }, [shareUrl]);
  const inAppName = useMemo(() => detectInAppBrowser(), []);

  const gradeOptions: SegmentOption<`${Grade}`>[] = GRADES.map(g => ({
    value: `${g}`,
    label: (
      <>
        {!isGradeAvailable(g) && <LineIcon name="hud/lock" size={15} />}
        <span>{g}학년</span>
      </>
    ),
    ariaLabel: isGradeAvailable(g) ? `${g}학년` : `${g}학년, 문제 준비 중`,
    disabled: !isGradeAvailable(g),
  }));

  const difficultyOptions: SegmentOption<DifficultyPreset>[] = [
    { value: 'none', label: '자유 선택' },
    ...DIFFICULTY_IDS.map(d => ({ value: d, label: DIFFICULTY_COPY[d].label })),
  ];

  const handleCopy = async () => {
    const ok = await copyText(shareUrl);
    setStatusMsg(ok ? '입장 주소를 복사했어요.' : '주소를 길게 눌러 복사해 주세요.');
  };

  return (
    <Modal titleId="classroomQrModalTitle" title="교실 입장 QR · 주소" size={projectorMode ? 'md' : 'sm'} onClose={onClose}>
      {projectorMode && qr.svg ? (
        <div className={qrCss.projectorWrap}>
          <p className={qrCss.projectorBadge}>
            {grade}학년{difficulty !== 'none' ? ` · ${DIFFICULTY_COPY[difficulty].label}` : ''}
          </p>
          <div className={qrCss.projectorBox}>
            <svg
              viewBox={`0 0 ${qr.svg.viewBoxSize} ${qr.svg.viewBoxSize}`}
              role="img"
              aria-label="교실 입장 QR 코드"
              shapeRendering="crispEdges"
              className={qrCss.projectorSvg}
            >
              <rect width={qr.svg.viewBoxSize} height={qr.svg.viewBoxSize} fill="#ffffff" />
              <path d={qr.svg.path} fill="#111111" />
            </svg>
          </div>
          <p className={qrCss.projectorUrl}>{shareUrl}</p>
          <Button size="lg" onClick={() => setProjectorMode(false)}>작게 보기</Button>
        </div>
      ) : (
        <div className={css.qrModalStack}>
          <Segmented
            label="입장 학년"
            options={gradeOptions}
            value={`${grade}`}
            onChange={v => {
              setStatusMsg(null);
              setGrade(Number(v) as Grade);
            }}
            onBlocked={() => setStatusMsg(HOME_COPY.gradeSoon)}
          />

          <div className={qrCss.difficultyWrap}>
            <Segmented<DifficultyPreset>
              label="입장 난이도"
              options={difficultyOptions}
              value={difficulty}
              onChange={v => {
                setStatusMsg(null);
                setDifficulty(v);
              }}
            />
          </div>

          {qr.svg ? (
            <div className={css.qrFrameWrap}>
              <div className={css.qrCanvasBox}>
                <svg
                  viewBox={`0 0 ${qr.svg.viewBoxSize} ${qr.svg.viewBoxSize}`}
                  role="img"
                  aria-label="교실 입장 QR 코드"
                  shapeRendering="crispEdges"
                  className={css.qrSvg}
                >
                  <rect width={qr.svg.viewBoxSize} height={qr.svg.viewBoxSize} fill="#ffffff" />
                  <path d={qr.svg.path} fill="#111111" />
                </svg>
              </div>
              <p className={css.qrGuideText}>
                태블릿·휴대전화 카메라로 비추면 선택한 학년으로 바로 열려요.
              </p>
              <Button size="md" onClick={() => setProjectorMode(true)}>교실 화면 크게 보기</Button>
            </div>
          ) : (
            <p className={css.qrGuideText} role="status">{qr.hint}</p>
          )}

          <Card sunk pad="sm" className={css.qrUrlBox}>
            <span className={css.qrUrlText}>{shareUrl}</span>
            <Button variant="primary" size="md" onClick={() => void handleCopy()}>
              주소 복사
            </Button>
          </Card>

          {inAppName && (
            <p className={css.qrNotice}>
              {inAppName} 안에서 열었을 때 화면이 어색하면 오른쪽 위 메뉴에서 &lsquo;다른 브라우저로 열기&rsquo;를 눌러 주세요.
            </p>
          )}

          {statusMsg && (
            <p className={css.qrStatus} role="status" aria-live="polite">
              {statusMsg}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
