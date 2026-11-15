import { useMemo, useState } from 'react';
import { buildClassroomShareUrl, detectInAppBrowser } from '../../../application/entryUrl';
import { cleanPublicSchoolCode, cleanPublicSchoolName } from '../../../contracts/lobby';
import { isGradeAvailable } from '../../../content';
import { HOME_COPY } from '../../copy';
import { ArtIcon, Button, Card, Modal, Segmented, Toggle, type SegmentOption } from '../../kit';
import { encodeQrMatrix, qrMatrixToSvgPath } from '../../utils/qr';
import css from './home.module.css';

const GRADES = [3, 4, 5, 6] as const;
type Grade = (typeof GRADES)[number];

interface Props {
  defaultGrade: Grade;
  schoolName: string;
  schoolCode: string;
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

export function ClassroomQrModal({ defaultGrade, schoolName, schoolCode, onClose }: Props) {
  const cleanSchool = cleanPublicSchoolName(schoolName);
  const cleanCode = cleanSchool ? cleanPublicSchoolCode(schoolCode) : '';
  const initialGrade: Grade = isGradeAvailable(defaultGrade) ? defaultGrade : 3;

  const [grade, setGrade] = useState<Grade>(initialGrade);
  const [includeSchool, setIncludeSchool] = useState(cleanSchool !== '');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const shareUrl = useMemo(
    () =>
      buildClassroomShareUrl({
        grade,
        ...(includeSchool && cleanSchool ? { schoolName: cleanSchool } : {}),
        ...(includeSchool && cleanCode ? { schoolCode: cleanCode } : {}),
      }),
    [grade, includeSchool, cleanSchool, cleanCode],
  );

  const qrSvg = useMemo(() => qrMatrixToSvgPath(encodeQrMatrix(shareUrl), 4), [shareUrl]);
  const inAppName = useMemo(() => detectInAppBrowser(), []);

  const gradeOptions: SegmentOption<`${Grade}`>[] = GRADES.map(g => ({
    value: `${g}`,
    label: (
      <>
        {!isGradeAvailable(g) && <ArtIcon name="lock" size={15} />}
        <span>{g}학년</span>
      </>
    ),
    ariaLabel: isGradeAvailable(g) ? `${g}학년` : `${g}학년, 문제 준비 중`,
    disabled: !isGradeAvailable(g),
  }));

  const handleCopy = async () => {
    const ok = await copyText(shareUrl);
    setStatusMsg(ok ? '입장 주소를 복사했어요.' : '주소를 길게 눌러 복사해 주세요.');
  };

  return (
    <Modal titleId="classroomQrModalTitle" title="교실 입장 QR · 주소" size="sm" onClose={onClose}>
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

        {cleanSchool !== '' && (
          <Toggle
            label={`학교 이름 함께 전달 (${cleanSchool})`}
            checked={includeSchool}
            onChange={next => {
              setStatusMsg(null);
              setIncludeSchool(next);
            }}
          />
        )}

        <div className={css.qrFrameWrap}>
          <div className={css.qrCanvasBox}>
            <svg
              viewBox={`0 0 ${qrSvg.viewBoxSize} ${qrSvg.viewBoxSize}`}
              role="img"
              aria-label="교실 입장 QR 코드"
              shapeRendering="crispEdges"
              className={css.qrSvg}
            >
              <rect width={qrSvg.viewBoxSize} height={qrSvg.viewBoxSize} fill="#ffffff" />
              <path d={qrSvg.path} fill="#111111" />
            </svg>
          </div>
          <p className={css.qrGuideText}>
            태블릿·휴대전화 카메라로 비추면 선택한 학년으로 바로 열려요.
          </p>
        </div>

        <Card sunk pad="sm" className={css.qrUrlBox}>
          <span className={css.qrUrlText}>{shareUrl}</span>
          <Button variant="primary" size="md" onClick={() => void handleCopy()}>
            주소 복사
          </Button>
        </Card>

        {statusMsg && (
          <p className={css.schoolModalStatus} role="status" aria-live="polite">
            {statusMsg}
          </p>
        )}

        {inAppName && (
          <Card sunk pad="sm">
            <p className={css.qrWebviewHint}>
              {inAppName} 안에서는 오른쪽 위 메뉴의 ‘다른 브라우저로 열기’로 열면 소리·기록 저장이 더 안정적이에요.
            </p>
          </Card>
        )}
      </div>
    </Modal>
  );
}
