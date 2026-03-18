import EmailIcon from "@mui/icons-material/Email";
import QrCodeIcon from "@mui/icons-material/QrCode";
import ShareIcon from "@mui/icons-material/Share";
import BarcodeReaderIcon from "@mui/icons-material/BarcodeReader";
import CompressIcon from "@mui/icons-material/Compress";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import CropIcon from "@mui/icons-material/Crop";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import ReceiptIcon from "@mui/icons-material/Receipt";
import DifferenceIcon from "@mui/icons-material/Difference";
import DataObjectIcon from "@mui/icons-material/DataObject";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";
import ScheduleIcon from "@mui/icons-material/Schedule";
import KeyIcon from "@mui/icons-material/Key";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import EnhancedEncryptionIcon from "@mui/icons-material/EnhancedEncryption";
import ApiIcon from "@mui/icons-material/Api";
import ArticleIcon from "@mui/icons-material/Article";
import GridOnIcon from "@mui/icons-material/GridOn";
import TextSnippetIcon from "@mui/icons-material/TextSnippet";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import FindInPageIcon from "@mui/icons-material/FindInPage";
import TableViewIcon from "@mui/icons-material/TableView";
import SubtitlesIcon from "@mui/icons-material/Subtitles";
import MicIcon from "@mui/icons-material/Mic";
import type { SvgIconComponent } from "@mui/icons-material";

export const toolIcons: Record<string, SvgIconComponent> = {
  "bulk-email": EmailIcon,
  "text-to-qr": QrCodeIcon,
  "text-share": ShareIcon,
  "barcode-generator": BarcodeReaderIcon,
  "image-compressor": CompressIcon,
  "image-format-converter": SwapHorizIcon,
  "image-pdf-to-pdf": PictureAsPdfIcon,
  "pdf-splitter": CallSplitIcon,
  "image-crop-tool": CropIcon,
  "image-background-editor": AutoFixHighIcon,
  "invoice-generator": ReceiptIcon,
  "text-diff-checker": DifferenceIcon,
  "json-formatter-validator": DataObjectIcon,
  "spring-boot-log-analyzer": ManageSearchIcon,
  "cron-generator-validator": ScheduleIcon,
  "jwt-encoder-decoder": KeyIcon,
  "uuid-generator": FingerprintIcon,
  "string-encryptor": EnhancedEncryptionIcon,
  "api-forge": ApiIcon,
  "word-to-pdf": ArticleIcon,
  "excel-to-pdf": GridOnIcon,
  "pdf-to-word": TextSnippetIcon,
  "image-generator": AutoAwesomeIcon,
  "pdf-text-extractor": FindInPageIcon,
  "excel-to-csv": TableViewIcon,
  "subtitle-downloader": SubtitlesIcon,
  "speech-to-text": MicIcon,
};
