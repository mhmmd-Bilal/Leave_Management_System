import LeaveCalendar from "../../components/LeaveCalendar.jsx";
import PageHeader from "../../components/ui/PageHeader.jsx";

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Leave calendar" subtitle="Approved leave by month" />
      <LeaveCalendar />
    </>
  );
}
