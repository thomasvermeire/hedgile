import { dateOf, isBackdated } from '../posting/dates';

/** Shows a transaction's system date and posting date, flagging a backdated posting. */
export function PostingDates({
  systemDate,
  postingDate,
}: {
  systemDate: string;
  postingDate: string;
}) {
  return (
    <span className="posting-dates">
      <span>
        System date <time dateTime={systemDate}>{dateOf(systemDate)}</time>
      </span>
      <span>
        Posting date <time dateTime={postingDate}>{postingDate}</time>
      </span>
      {isBackdated(postingDate, systemDate) && (
        <span className="badge badge--backdated">Backdated</span>
      )}
    </span>
  );
}
