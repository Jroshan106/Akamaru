import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

export default function BackChevron({ forward = false }: { forward?: boolean }) {
  return <FontAwesomeIcon icon={forward ? faChevronRight : faChevronLeft} className="back-chevron" aria-hidden="true" />;
}
