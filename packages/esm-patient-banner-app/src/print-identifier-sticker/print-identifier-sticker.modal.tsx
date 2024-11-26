import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import ReactDOMServer from 'react-dom/server';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useReactToPrint } from 'react-to-print';
import {
  Button,
  Column,
  Grid,
  InlineLoading,
  ModalBody,
  ModalFooter,
  ModalHeader,
  NumberInput,
  Stack,
  Toggle,
} from '@carbon/react';
import { getPatientName, getCoreTranslation, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { type ConfigObject } from '../config-schema';
import PrintComponent from './print-identifier-sticker.component';
import styles from './print-identifier-sticker.scss';
import { type PrintPatientStickerConfig, usePrintPatientStickerConfig } from './print-identifier-sticker.resource';
import { PDFViewer, Document, Page, View, Text } from '@react-pdf/renderer';
import { jsPDF } from 'jspdf';

interface PrintIdentifierStickerProps {
  closeModal: () => void;
  patient: fhir.Patient;
}

interface PrintMultipleStickersComponentProps {
  patient: fhir.Patient;
  printPatientSticker: PrintPatientStickerConfig;
  isError?: boolean;
  isLoading?: boolean;
}

const PrintIdentifierSticker: React.FC<PrintIdentifierStickerProps> = ({ closeModal, patient }) => {
  const { t } = useTranslation();
  const { printPatientStickerConfig } = useConfig<ConfigObject>();
  const { printPatientSticker, isError, isLoading } = usePrintPatientStickerConfig(printPatientStickerConfig);
  const [isPrinting, setIsPrinting] = useState(false);
  const headerTitle = t('patientIdentifierSticker', 'Patient identifier sticker');

  const contentToPrintRef = useRef(null);
  const onBeforeGetContentResolve = useRef<() => void | null>(null);

  useEffect(() => {
    if (isPrinting && onBeforeGetContentResolve.current) {
      onBeforeGetContentResolve.current();
    }
  }, [isPrinting]);

  const generatePDF = useCallback(() => {
    if (contentToPrintRef.current) {
      setIsPrinting(true);
      const doc = new jsPDF({
        unit: 'mm',
        orientation: 'l',
        format: [50, 70],
      });
      doc.getFormObject;
      doc.html(contentToPrintRef.current, {
        callback: (pdf) => {
          pdf.setFontSize(2);
          pdf.save('stickers.pdf');
          pdf.autoPrint();
          window.open(doc.output('bloburl'), '_blank');
          setIsPrinting(false);
        },
        x: 0,
        y: 0,
      });
    }
  }, []);

  const handleBeforeGetContent = useCallback(
    () =>
      new Promise<void>((resolve) => {
        if (patient && headerTitle) {
          onBeforeGetContentResolve.current = resolve;
          setIsPrinting(true);
        }
      }),
    [headerTitle, patient],
  );

  const handleAfterPrint = useCallback(() => {
    onBeforeGetContentResolve.current = null;
    setIsPrinting(false);
    closeModal();
  }, [closeModal]);

  const handlePrintWindow = useCallback((printWindow: HTMLIFrameElement | null): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (printWindow) {
        const printContent = printWindow.contentDocument || printWindow.contentWindow?.document;
        if (printContent) {
          printContent.body.style.overflow = 'initial !important';
          printWindow.contentWindow?.print();
        }
      }
      resolve();
    });
  }, []);

  const handlePrintError = useCallback((errorLocation, error) => {
    onBeforeGetContentResolve.current = null;

    showSnackbar({
      isLowContrast: false,
      kind: 'error',
      title: getCoreTranslation('printError', 'Print error'),
      subtitle:
        getCoreTranslation('printErrorExplainer', 'An error occurred in "{{errorLocation}}": ', { errorLocation }) +
        error,
    });

    setIsPrinting(false);
  }, []);

  const handlePrint = useReactToPrint({
    content: () => contentToPrintRef.current,
    documentTitle: `${getPatientName(patient)} - ${headerTitle}`,
    onAfterPrint: handleAfterPrint,
    onBeforeGetContent: handleBeforeGetContent,
    onPrintError: handlePrintError,
    print: handlePrintWindow,
    copyStyles: true,
  });

  return (
    <>
      <ModalHeader
        closeModal={closeModal}
        title={getCoreTranslation('printIdentifierSticker', 'Print identifier sticker')}
      />
      <ModalBody aria-label={t('printIdentifierStickerModal', 'Print identifier sticker modal')} hasScrollingContent>
        <PrintMultipleStickersComponent
          printPatientSticker={printPatientSticker}
          patient={patient}
          ref={contentToPrintRef}
        />
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={closeModal}>
          {getCoreTranslation('cancel', 'Cancel')}
        </Button>
        <Button className={styles.button} disabled={isPrinting} onClick={generatePDF} kind="primary">
          {isPrinting ? (
            <InlineLoading className={styles.loader} description={getCoreTranslation('printing', 'Printing') + '...'} />
          ) : (
            getCoreTranslation('print', 'Print')
          )}
        </Button>
      </ModalFooter>
    </>
  );
};

const PrintMultipleStickersComponent = forwardRef<HTMLDivElement, PrintMultipleStickersComponentProps>(
  ({ printPatientSticker, patient }, ref) => {
    const divRef = useRef<HTMLIFrameElement>();
    const { t } = useTranslation();

    const { height: printIdentifierStickerHeight, width: printIdentifierStickerWidth } = printPatientSticker ?? {};
    const [numberOfLabelColumnsPage, setNumberOfLabelColumnsPage] = useState<number>(
      printPatientSticker.numberOfColumnsPerPage,
    );
    const [numberOfLabelRowsPerPage, setNumberOfLabelRowsPerPage] = useState<number>(
      printPatientSticker.numberOfRowsPerPage,
    );
    const [numberOfLabels, setNumberOfLabels] = useState<number>(printPatientSticker.numberOfStickers);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [isMultipleStickersEnabled, setIsMultipleStickersEnabled] = useState(
      printPatientSticker.numberOfStickers > 1,
    );

    const [svgDataSource, setSvgDataSource] = useState('');

    const labels = Array.from({ length: numberOfLabels });

    useImperativeHandle(ref, () => divRef.current, []);

    useEffect(() => {
      if (divRef.current) {
        const style = divRef.current.style;
        style.setProperty('--omrs-print-label-paper-size', 'auto');
        style.setProperty('--omrs-print-label-columns', numberOfLabelColumnsPage.toString());
        style.setProperty('--omrs-print-label-rows', numberOfLabelRowsPerPage.toString());
        style.setProperty('--omrs-print-label-sticker-height', printIdentifierStickerHeight.toString());
        style.setProperty('--omrs-print-label-sticker-width', printIdentifierStickerWidth.toString());
      }
    }, [
      numberOfLabelColumnsPage,
      numberOfLabelRowsPerPage,
      printIdentifierStickerHeight,
      printIdentifierStickerWidth,
      printPatientSticker?.pageSize,
    ]);

    const maxLabelsPerPage = numberOfLabelRowsPerPage * numberOfLabelColumnsPage;
    const pages: Array<typeof labels> = [];

    for (let i = 0; i < labels.length; i += maxLabelsPerPage) {
      pages.push(labels.slice(i, i + maxLabelsPerPage));
    }

    if (numberOfLabelColumnsPage < 1 || numberOfLabelRowsPerPage < 1 || labels.length < 1) {
      return;
    }

    return (
      <Stack gap={5}>
        <Grid className={styles.gridContainer}>
          <Column lg={6} md={8} sm={4}>
            <Toggle
              className={styles.multipleStickerToggle}
              defaultToggled={isMultipleStickersEnabled}
              size="sm"
              labelText={t('printMultipleStickers', 'Print multiple stickers')}
              id="print-multiple-stickers-toggle"
              labelA=""
              labelB=""
              onToggle={() => setIsMultipleStickersEnabled(!isMultipleStickersEnabled)}
            />
          </Column>

          {isMultipleStickersEnabled ? (
            <Column lg={10} md={8} sm={4}>
              <div className={styles.multipleStickerInputs}>
                <NumberInput
                  hideSteppers
                  id="columnsPerPageInput"
                  label={t('columnsPerPage', 'Columns per page')}
                  min={1}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setNumberOfLabelColumnsPage(parseInt(event.target.value || '1'))
                  }
                  value={numberOfLabelColumnsPage}
                />
                <NumberInput
                  hideSteppers
                  id="rowsPerPageInput"
                  label={t('rowsPerPage', 'Rows per page')}
                  min={1}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setNumberOfLabelRowsPerPage(parseInt(event.target.value || '1'))
                  }
                  value={numberOfLabelRowsPerPage}
                />
                <NumberInput
                  hideSteppers
                  id="totalNumberInput"
                  label={t('totalNumber', 'Total number')}
                  min={1}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setNumberOfLabels(parseInt(event.target.value || '1'))
                  }
                  value={numberOfLabels}
                />
              </div>
              <Button
                className={styles.previewButton}
                kind="ghost"
                onClick={() => setIsPreviewVisible(!isPreviewVisible)}
              >
                {!isPreviewVisible ? t('showPreview', 'Show preview') : t('hidePreview', 'Hide preview')}
              </Button>
            </Column>
          ) : null}
        </Grid>
        <div className={classNames(styles.previewContainer, !isPreviewVisible ? styles.hidePreviewContainer : '')}>
          <div ref={divRef} className={styles.printRoot}>
            {pages.map((pageLabels, pageIndex) => (
              <div key={pageIndex} className={pageIndex < pages.length - 1 ? styles.pageBreak : ''}>
                <div className={styles.labelsContainer}>
                  {pageLabels.map((_label, index) => (
                    <div key={index} className={styles.printContainer}>
                      <PrintComponent patient={patient} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Stack>
    );
  },
);

export default PrintIdentifierSticker;
