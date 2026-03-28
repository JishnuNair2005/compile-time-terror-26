import React, { useState } from "react";
import { loginTeacher } from "./auth";

function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            alert("Enter email and password");
            return;
        }

        setLoading(true);

        const success = await loginTeacher(email, password);

        setLoading(false);

        if (success) {
            window.location.href = "/dashboard";
        }
    };

    return (
        <div style={{ textAlign: "center", marginTop: "100px" }}>
            <h2>Teacher Login</h2>

            <input
                type="email"
                placeholder="Enter Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                    display: "block",
                    margin: "10px auto",
                    padding: "10px",
                    width: "250px"
                }}
            />

            <input
                type="password"
                placeholder="Enter Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                    display: "block",
                    margin: "10px auto",
                    padding: "10px",
                    width: "250px"
                }}
            />

            <button
                onClick={handleLogin}
                disabled={loading}
                style={{
                    padding: "10px 20px",
                    backgroundColor: "#4CAF50",
                    color: "white",
                    border: "none",
                    cursor: "pointer"
                }}
            >
                {loading ? "Logging in..." : "Login"}
            </button>
        </div>
    );
}

export default Login;