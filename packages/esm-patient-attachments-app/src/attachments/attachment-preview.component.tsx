import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, OverflowMenu, OverflowMenuItem } from '@carbon/react';
import { type Attachment, CloseIcon, useLayoutType } from '@openmrs/esm-framework';
import styles from './attachment-preview.scss';
import Linkify from 'linkify-react';
import { showSnackbar } from '@openmrs/esm-framework';

// Recognise the viewer link by what it IS, not by where it happens to be hosted. Testing for
// ':8889' (Orthanc's loopback debug port) only ever matches a local dev stack; on a real
// deployment the stored link is the public one, so such a guard is never true.
export function isOrthancViewerUrl(description: string | undefined): boolean {
  const url = description ?? '';
  return url.includes('stone-webviewer') || url.includes('orthancId=') || url.includes(':8889');
}

// The stored link carries the Orthanc study id but no credentials. Trade it for a short-lived,
// study-scoped token; the endpoint returns the finished viewer URL, so none is built here.
export async function openDicomViewer(description: string | undefined): Promise<void> {
  const normalized = (description ?? '').replace(/&amp;/g, '&');
  const orthancId = normalized.match(/[?&]orthancId=([^&#]+)/)?.[1];
  const study = normalized.match(/[?&]study=([^&#]+)/)?.[1];
  const studyId = orthancId ?? study;

  if (!studyId) {
    showSnackbar({
      title: 'DICOM Viewer Error',
      subtitle: 'Could not extract the study id from this attachment.',
      kind: 'error',
    });
    return;
  }

  try {
    const response = await fetch(`/openmrs/ws/rest/v1/orthanc/token?studyId=${encodeURIComponent(studyId)}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (response.status === 401) {
      // /openmrs/oauth2login, not the legacy /openmrs/login.htm: this deployment sits behind
      // Keycloak, and the legacy form would be redirected anyway, losing the return path.
      window.location.href = `/openmrs/oauth2login?redirect=${encodeURIComponent(window.location.href)}`;
      return;
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const { url } = await response.json();
    if (!url) {
      throw new Error('token endpoint returned no url');
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    showSnackbar({
      title: 'DICOM Viewer Error',
      subtitle: `Could not open the DICOM viewer: ${err}`,
      kind: 'error',
    });
  }
}

interface AttachmentPreviewProps {
  attachmentToPreview: Attachment;
  onClosePreview: () => void;
  onDeleteAttachment: (attachment: Attachment) => void;
}

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachmentToPreview,
  onClosePreview,
  onDeleteAttachment,
}) => {
  const { t } = useTranslation();
  const isTablet = useLayoutType() === 'tablet';
  const isPdf = attachmentToPreview.bytesContentFamily === 'PDF';
  const isImage = attachmentToPreview.bytesContentFamily === 'IMAGE';
  const responsiveSize = isTablet ? 'lg' : 'md';

  useEffect(() => {
    const closePreviewOnEscape = (event) => {
      if (event.key == 'Escape') {
        onClosePreview();
      }
    };

    window.addEventListener('keydown', closePreviewOnEscape);

    return () => {
      window.removeEventListener('keydown', closePreviewOnEscape);
    };
  }, [onClosePreview]);

  return (
    <div className={styles.previewContainer}>
      <div className={styles.leftPanel}>
        <Button
          className={styles.closePreviewButton}
          hasIconOnly
          iconDescription={t('closePreview', 'Close preview')}
          kind="ghost"
          onClick={onClosePreview}
          renderIcon={CloseIcon}
          size={responsiveSize}
        />
        <div className={styles.attachmentPreview}>
          {isImage ? (
            <img src={attachmentToPreview.src} alt={attachmentToPreview.filename} />
          ) : isPdf ? (
            <iframe className={styles.pdfViewer} src={attachmentToPreview.src} title="PDFViewer" />
          ) : null}
        </div>
        <OverflowMenu className={styles.overflowMenu} flipped size={responsiveSize}>
          <OverflowMenuItem
            aria-label={t('options', 'Options')}
            className={styles.menuItem}
            hasDivider
            isDelete
            itemText={isPdf ? t('deletePdf', 'Delete PDF') : t('deleteImage', 'Delete image')}
            onClick={() => onDeleteAttachment(attachmentToPreview)}
          />
        </OverflowMenu>
      </div>
      <div className={styles.rightPanel}>
        <h4 className={styles.title}>{attachmentToPreview.filename}</h4>
        {attachmentToPreview?.description ? (
          isOrthancViewerUrl(attachmentToPreview.description) ? (
            // A DICOM viewer link must NOT be rendered as a plain anchor. Linkify would turn the
            // stored URL into <a href>, and clicking it is an ordinary browser navigation - no
            // JavaScript runs, so no viewer token is ever requested and Orthanc answers 403 on
            // every dicom-web call, leaving a black viewer. Measured on UAT: zero requests to
            // /orthanc/token across 236 requests on the page.
            //
            // Instead, exchange the study id for a short-lived token and open the URL the backend
            // hands back. That URL is already complete and tokenised, so nothing is assembled here.
            <Button kind="ghost" size="sm" onClick={() => openDicomViewer(attachmentToPreview.description)}>
              {t('openDicomViewer', 'Open DICOM viewer')}
            </Button>
          ) : (
            <p className={styles.imageDescription}>
              <Linkify options={{ target: '_blank' }}>{attachmentToPreview.description}</Linkify>
            </p>
          )
        ) : null}
      </div>
    </div>
  );
};

export default AttachmentPreview;
