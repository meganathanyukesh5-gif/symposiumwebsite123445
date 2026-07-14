import axios from "axios";
import { API_BASE } from "../config/api";


const Register = ({ openJoinTeam }) => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("All");
  const [emailError, setEmailError] = useState("");
  const [showWarning, setShowWarning] = useState(false);

  const emailRef = useRef(null);


  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const paymentData = location.state || {};




  /* ---------------- STATE ---------------- */
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    college: "",
    dept: "",
    year: "",
    gender: "",
    selectedEvents: [],
    event: paymentData.eventName || "",
    amount: paymentData.amount || "",
    utr: paymentData.utr || "",
    teamName: "",
  });

  /* ---------------- AUTO OPEN JOIN TEAM ---------------- */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("join") === "true") {
      if (openJoinTeam) openJoinTeam();
      // Clear param
      navigate("/register", { replace: true });
    }
  }, [location, openJoinTeam, navigate]);


  const hasTeamEvent = formData.selectedEvents.some((sel) => sel.mode === "TEAM");
  const teamNameRef = useRef(null);

  useEffect(() => {
    if (hasTeamEvent && teamNameRef.current) {
      setTimeout(() => {
        teamNameRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [hasTeamEvent]);

  const [totalAmount, setTotalAmount] = useState(0);

  /* ---------------- WARNING MODAL ON MOUNT ---------------- */
  useEffect(() => {
    // Check if we've already shown it this session (optional, but user said "first time opening")
    // For now, let's show it every time they visit the page to be safe, 
    // or use sessionStorage to show only once per session.
    // User request: "when first time opening registration form"
    // specific interpretation: Show once per browser session.

    const hasSeenWarning = sessionStorage.getItem("synerix_registration_warning_seen");
    if (!hasSeenWarning) {
      setShowWarning(true);
    }
  }, []);

  const closeWarning = () => {
    setShowWarning(false);
    sessionStorage.setItem("synerix_registration_warning_seen", "true");
  };

  /* ---------------- RESTORE FORM DRAFT ---------------- */
  useEffect(() => {
    const savedForm = sessionStorage.getItem("synerix_form_draft");
    if (savedForm) {
      setFormData(JSON.parse(savedForm));
    }
  }, []);

  const filteredEvents = eventsData.filter((event) => {
    const matchesSearch = event.title
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesCategory =
      filter === "All" || event.category === filter;

    return matchesSearch && matchesCategory;
  });


  /* ---------------- INPUT HANDLER ---------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "phone") {
      let cleaned = value.replace(/\D/g, "");
      if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
      cleaned = cleaned.slice(0, 10);
      setFormData((prev) => ({ ...prev, phone: cleaned }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };


  /* ---------------- EVENT SELECT / DESELECT ---------------- */
  const toggleEvent = (event) => {
    setFormData((prev) => {
      const exists = prev.selectedEvents.find(
        (e) => e.eventId === event.id
      );

      let updatedEvents;
      if (exists) {
        updatedEvents = prev.selectedEvents.filter(
          (e) => e.eventId !== event.id
        );
      } else {
        updatedEvents = [
          ...prev.selectedEvents,
          { eventId: event.id, mode: event.modes[0] },
        ];
      }

      return { ...prev, selectedEvents: updatedEvents };
    });
  };


  /* ---------------- MODE CHANGE ---------------- */
  const changeMode = (eventId, mode) => {
    setFormData((prev) => ({
      ...prev,
      selectedEvents: prev.selectedEvents.map((e) =>
        e.eventId === eventId ? { ...e, mode } : e
      ),
    }));
  };

  /* ---------------- TOTAL CALCULATION ---------------- */
  useEffect(() => {
    let total = 0;

    for (const sel of formData.selectedEvents) {
      const event = eventsData.find((e) => e.id === sel.eventId);
      if (!event) continue;

      const price = event.fee?.[sel.mode];

      // Free for Girls in Technical & Workshop (Solo mode)
      let finalPrice = price;
      if (
        formData.gender === "Female" &&
        sel.mode === "SOLO" &&
        (event.category === "Technical" || event.category === "Workshop")
      ) {
        finalPrice = 0;
      }

      if (typeof finalPrice === "number") total += finalPrice;
    }

    if (emailError && emailRef.current) {
      emailRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      emailRef.current.focus();
    }
    setTotalAmount(total);
  }, [formData.selectedEvents, emailError, formData.gender]);

  const isFormValid =
    formData.name.trim() &&
    formData.email.trim() &&
    formData.phone.length === 10 &&
    formData.college.trim() &&
    formData.phone.length === 10 &&
    formData.college.trim() &&
    formData.dept.trim() &&
    formData.gender &&
    formData.selectedEvents.length > 0 &&
    (!hasTeamEvent || formData.teamName.trim());

  /* ---------------- PAY & REGISTER ---------------- */
  const handlePayAndRegister = async () => {
    if (!isFormValid) {
      alert("Please complete the form and select events");
      return;
    }
    if (loading) return; // Prevent double submission if button somehow stays enabled

    setLoading(true);

    try {
      await axios.post(`${API_BASE}/api/check-email`, {
        email: formData.email,
      });

      // save draft
      sessionStorage.setItem(
        "synerix_form_draft",
        JSON.stringify(formData)
      );
      const selectedEventNames = formData.selectedEvents
        .map((sel) => {
          const event = eventsData.find((e) => e.id === sel.eventId);
          return event?.title;
        })
        .filter(Boolean)
        .join(", ");


      const eventsDetail = formData.selectedEvents.map((sel) => {
        const event = eventsData.find((e) => e.id === sel.eventId);
        return {
          title: event?.title,
          mode: sel.mode
        };
      });

      // ---------------- IF FREE REGISTRATION ---------------- //
      if (totalAmount === 0) {
        try {
          const freeUTR = `FREE-${Date.now()}`;
          const res = await axios.post(`${API_BASE}/api/register`, {
            ...formData,
            event: selectedEventNames,
            amount: 0,
            utr: freeUTR,
            teamName: hasTeamEvent ? formData.teamName : "",
            eventsDetail // 👈 Added this
          });

          if (res.data.success) {
            navigate("/success", {
              state: {
                registrationId: res.data.registrationId,
                amount: 0,
                utr: freeUTR
              }
            });
          }
          return;
        } catch (regErr) {
          console.error("FREE REG ERROR:", regErr);
          alert("Registration failed. Please try again.");
          setLoading(false);
          return;
        }
      }



      // ---------------- IF PAID ---------------- //
      navigate("/payment", {
        state: {
          amount: totalAmount,
          event: selectedEventNames,
          teamName: hasTeamEvent ? formData.teamName : "",
          eventsDetail, // 👈 Added
          formData // Pass full form data to easy restore or use
        },
      });

    } catch (err) {
      if (err.response) {
        const { status, message } = err.response.data;

        // EMAIL EXISTS
        if (err.response.status === 409) {
          setEmailError(message);
          setLoading(false);
          return;
        }

        // MISSING FIELDS / BAD REQUEST
        if (err.response.status === 400) {
          alert(message);
          setLoading(false);
          return;
        }

        // ANY OTHER BACKEND ERROR
        alert(message || "Server error");
      } else {
        alert("Network error. Please try again.");
      }
    } finally {
      // In case of success (navigating away), we don't strictly need to set loading false,
      // but if navigation is delayed or fails, it is safer.
      // However, since we have explicit returns on success above (which navigate),
      // we might only reach here on error if we didn't return.
      // Actually, the catch block catches errors.
      // Let's ensure loading is false if we didn't navigate.
      if (emailError) setLoading(false);
    }
    setLoading(false);
  };



  /* ---------------- STYLES ---------------- */
  const inputStyle = {
    width: "100%",
    padding: "1rem",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid var(--color-border)",
    color: "#fff",
    marginBottom: "1rem",
  };

  const technicalEvents = filteredEvents.filter(
    e => e.category === "Technical"
  );

  const nonTechnicalEvents = filteredEvents.filter(
    e => e.category === "Non-Technical"
  );

  const workshopEvents = filteredEvents.filter(
    e => e.category === "Workshop"
  );


  const renderEventCard = (event) => {
    const selected = formData.selectedEvents.find(
      (e) => e.eventId === event.id
    );

    return (
      <div
        key={event.id}
        onClick={() => toggleEvent(event)}
        style={{
          padding: "1rem",
          cursor: "pointer",
          border: selected
            ? "2px solid var(--color-secondary)"
            : "1px solid var(--color-border)",
          background: selected
            ? "rgba(0,240,255,0.08)"
            : "rgba(255,255,255,0.03)",
        }}
      >
        <h4>
          {event.title}
        </h4>
        <p style={{ fontSize: "0.85rem", opacity: 0.75 }}>
          Fee:&nbsp;
          {event.modes.length === 1 ? (
            (formData.gender === "Female" && event.modes[0] === "SOLO" && (event.category === "Technical" || event.category === "Workshop")) ? (
              <span><s style={{ opacity: 0.6 }}>₹{event.fee?.[event.modes[0]] ?? 0}</s> <b style={{ color: "#00c8ffff" }}>FREE</b></span>
            ) : (
              <b>₹{event.fee?.[event.modes[0]] ?? 0}</b>
            )
          ) : (
            event.modes.map((mode, i) => {
              const isFree = formData.gender === "Female" && mode === "SOLO" && (event.category === "Technical" || event.category === "Workshop");
              return (
                <span key={mode}>
                  {mode}: {isFree ? <span><s style={{ opacity: 0.6 }}>₹{event.fee?.[mode] ?? 0}</s> <b style={{ color: "#00c8ffff" }}>FREE</b></span> : `₹${event.fee?.[mode] ?? 0}`}
                  {i < event.modes.length - 1 && " | "}
                </span>
              );
            })
          )}
        </p>

        {selected && event.modes.length > 1 && (
          <select
            value={selected.mode}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) =>
              changeMode(event.id, e.target.value)
            }
            style={{ ...inputStyle, marginTop: "0.5rem" }}
          >
            {event.modes.map((mode) => (
              <option key={mode} value={mode}>
                {mode} – ₹{event.fee[mode]}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  };


}
  /* ---------------- UI ---------------- */
