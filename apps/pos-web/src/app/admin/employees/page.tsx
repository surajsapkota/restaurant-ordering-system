"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth/authstore";
import "./employees.css";

type Employee = {
  id: string;
  name: string;
  role: "EMPLOYEE" | "MANAGER";
  isActive: boolean;
  phone: string | null;
  employeeCode: string | null;
  createdAt: string;
  updatedAt: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function EmployeesPage() {
  const token = useAuthStore((s) => s.token);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"EMPLOYEE" | "MANAGER">("EMPLOYEE");
  const [editPhone, setEditPhone] = useState("");
  const [editPin, setEditPin] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [role, setRole] = useState<"EMPLOYEE" | "MANAGER">("EMPLOYEE");
  const [pin, setPin] = useState("");
  const [phone, setPhone] = useState("");
  function openEditModal(employee: Employee) {
    setEditingEmployeeId(employee.id);
    setEditName(employee.name);
    setEditRole(employee.role);
    setEditPhone(employee.phone || "");
    setEditPin("");
    setEditIsActive(employee.isActive);
    setShowEditForm(true);
  }

  async function handleEditEmployee(e: React.FormEvent) {
    e.preventDefault();
  
    if (!editingEmployeeId) return;
  
    try {
      setSubmitting(true);
      setError(null);
  
      const body: {
        name: string;
        role: "EMPLOYEE" | "MANAGER";
        phone?: string;
        pin?: string;
        isActive: boolean;
      } = {
        name: editName,
        role: editRole,
        isActive: editIsActive,
      };
  
      if (editPhone.trim()) {
        body.phone = editPhone.trim();
      }
  
      if (editPin.trim()) {
        body.pin = editPin.trim();
      }
  
      const res = await fetch(`${API_URL}/employees/${editingEmployeeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
  
      const data = await res.json();
  
      if (!res.ok) {
        throw new Error(data.error || "Failed to update employee");
      }
  
      setShowEditForm(false);
      setEditingEmployeeId(null);
      setEditName("");
      setEditRole("EMPLOYEE");
      setEditPhone("");
      setEditPin("");
      setEditIsActive(true);
  
      await loadEmployees();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(employeeId: string, employeeName: string) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${employeeName}?`
    );
  
    if (!confirmed) return;
  
    try {
      setError(null);
  
      const res = await fetch(`${API_URL}/employees/${employeeId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
  
      const data = await res.json();
  
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete employee");
      }
  
      await loadEmployees();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
  }

  async function loadEmployees() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_URL}/employees`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load employees");
      }

      setEmployees(data.items || []);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadEmployees();
  }, [token]);

  async function handleAddEmployee(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`${API_URL}/employees`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          role,
          pin,
          phone: phone.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create employee");
      }

      setName("");
      setRole("EMPLOYEE");
      setPin("");
      setPhone("");
      setShowAddForm(false);

      await loadEmployees();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(employeeId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to deactivate this employee?"
    );

    if (!confirmed) return;

    try {
      setError(null);

      const res = await fetch(`${API_URL}/employees/${employeeId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          isActive: false,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to deactivate employee");
      }

      await loadEmployees();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }
  }

  return (
    <div className="employees-page">
      <div className="employees-header">
        <div>
          <h1>Employees</h1>
          <p>Manage staff access, roles, and active employee accounts.</p>
        </div>

        <button
          className="employees-add-btn"
          onClick={() => setShowAddForm(true)}
        >
          + Add Employee
        </button>
      </div>

      {error && <div className="employees-error">{error}</div>}

      {showEditForm && (
        <div className="employees-modal-overlay">
        <div className="employees-modal">
            <div className="employees-modal-top">
            <h2>Edit Employee</h2>
            <button
                className="employees-close-btn"
                onClick={() => setShowEditForm(false)}
            >
                ✕
            </button>
            </div>

            <form onSubmit={handleEditEmployee} className="employees-form">
            <div className="employees-form-group">
                <label>Full Name</label>
                <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Enter employee name"
                required
                />
            </div>

            <div className="employees-form-group">
                <label>Role</label>
                <select
                value={editRole}
                onChange={(e) =>
                    setEditRole(e.target.value as "EMPLOYEE" | "MANAGER")
                }
                >
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                </select>
            </div>

            <div className="employees-form-group">
                <label>Phone</label>
                <input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Enter phone number"
                />
            </div>

            <div className="employees-form-group">
                <label>New 4-digit PIN (optional)</label>
                <input
                value={editPin}
                onChange={(e) => setEditPin(e.target.value)}
                placeholder="Leave blank to keep current PIN"
                maxLength={4}
                />
            </div>

            <div className="employees-form-group">
                <label>Status</label>
                <select
                value={editIsActive ? "active" : "inactive"}
                onChange={(e) => setEditIsActive(e.target.value === "active")}
                >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                </select>
            </div>

            <div className="employees-form-actions">
                <button
                type="button"
                className="employees-cancel-btn"
                onClick={() => setShowEditForm(false)}
                >
                Cancel
                </button>

                <button
                type="submit"
                className="employees-save-btn"
                disabled={submitting}
                >
                {submitting ? "Saving..." : "Save Changes"}
                </button>
            </div>
            </form>
        </div>
        </div>
        )}

      {showAddForm && (
        <div className="employees-modal-overlay">
          <div className="employees-modal">
            <div className="employees-modal-top">
              <h2>Add Employee</h2>
              <button
                className="employees-close-btn"
                onClick={() => setShowAddForm(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="employees-form">
              <div className="employees-form-group">
                <label>Full Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter employee name"
                  required
                />
              </div>

              <div className="employees-form-group">
                <label>Role</label>
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "EMPLOYEE" | "MANAGER")
                  }
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>

              <div className="employees-form-group">
                <label>4-digit PIN</label>
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Enter 4-digit PIN"
                  maxLength={4}
                  required
                />
              </div>

              <div className="employees-form-group">
                <label>Phone (optional)</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Enter phone number"
                />
              </div>

              <div className="employees-form-actions">
                <button
                  type="button"
                  className="employees-cancel-btn"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="employees-save-btn"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Create Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="employees-table-wrap">
        {loading ? (
          <div className="employees-empty">Loading employees...</div>
        ) : employees.length === 0 ? (
          <div className="employees-empty">No employees found yet.</div>
        ) : (
          <table className="employees-table">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
                </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.employeeCode || "—"}</td>
                  <td>{employee.name}</td>
                  <td>
                    <span className={`role-badge ${employee.role.toLowerCase()}`}>
                      {employee.role}
                    </span>
                  </td>
                  <td>{employee.phone || "—"}</td>
                  <td>
                    <span
                      className={
                        employee.isActive
                          ? "status-badge active"
                          : "status-badge inactive"
                      }
                    >
                      {employee.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{new Date(employee.createdAt).toLocaleDateString()}</td>
                  <td>
                    {employee.isActive ? (
                        <div className="employee-actions">
                            <button
                                className="action-btn edit"
                                onClick={() => openEditModal(employee)}
                                >
                                Edit
                            </button>
                        <button
                            className="action-btn deactivate"
                            onClick={() => handleDeactivate(employee.id)}
                        >
                            Deactivate
                        </button>

                        <button
                            className="action-btn delete"
                            onClick={() => handleDelete(employee.id, employee.name)}
                        >
                            Delete
                        </button>
                        </div>
                    ) : (
                        <div className="employee-actions">
                        <span className="inactive-label">Disabled</span>

                        <button
                            className="action-btn delete"
                            onClick={() => handleDelete(employee.id, employee.name)}
                        >
                            Delete
                        </button>
                        </div>
                    )}
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}