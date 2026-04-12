interface ExportWorldLineReportOptions {
  html: string;
  popupBlockedMessage: string;
}

export const exportWorldLineReport = ({
  html,
  popupBlockedMessage,
}: ExportWorldLineReportOptions) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.alert(popupBlockedMessage);
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
};
