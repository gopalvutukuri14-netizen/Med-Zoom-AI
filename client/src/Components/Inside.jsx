export const Inside = () => {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1 style={{ marginTop: "4rem" }}>
        Welcome to MedZoom AI{user ? `, ${user.name}` : ""}
      </h1>
      <p>You are logged in.</p>
    </div>
  );
};
