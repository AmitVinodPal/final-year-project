const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const PDFDocument = require("pdfkit");



// Import DB connection
const connectDB = require("./config/db");

// ----------------- INIT APP -----------------
const app = express();



// ----------------- CONNECT DB -----------------
connectDB();

// ----------------- SCHEMAS -----------------
// PAYMENT SCHEMA
const paymentSchema = new mongoose.Schema({
  coachId: String,
  coachName: String,
  amount: Number,
  paymentId: String,
  status: String, // SUCCESS / FAILED
  reason: String,
  date: String,
  time: String,
  createdAt: { type: Date, default: Date.now }
});

const Payment = mongoose.model("Payment", paymentSchema);

// STUDENT

const studentSchema = new mongoose.Schema({
  name: String,
  branch: String,
  status: {
    type: String,
    enum: ["Current", "Passed"],
    default: "Current"
  },
  phone: {
    type: String,
    required: true   // phone must be sent
  }
});


// FEES
const feeSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },
  branch: String,   // 👈 ADD THIS
  feeDate: String,
  totalFee: Number,
  paidAmount: Number,
  dueAmount: Number,
  status: {
    type: String,
    enum: ["Paid", "Partial", "Unpaid"]
  },
  paymentMode: String
});














// ATTENDANCE
const attendanceSchema = new mongoose.Schema({
  studentId: mongoose.Schema.Types.ObjectId,
  name: String,
  branch: String,
  date: String,
  status: String // Present / Absent
});

// TEACHER
const bcrypt = require("bcrypt");

const teacherSchema = new mongoose.Schema({
  name: String,
  username: {
    type: String,
    unique: true
  },
  password: String,
  role: {
    type: String,
    enum: ["admin", "coach"],
    default: "coach"
  }
});


// hash password before save
teacherSchema.pre("save", async function () {

  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

});





// TEACHER LOGIN LOG
const teacherLogSchema = new mongoose.Schema({
  teacherName: String, 
   teacherId: String, 
  branch: String,
  loginDate: String,
  loginTime: String,
  sessionType: String,
  sessionHours: Number,
  sessionMinutes: Number
});


teacherLogSchema.index(
  { teacherName: 1, loginDate: 1, loginTime: 1 },
  { unique: true }
);


// SESSION (MAIN BUSINESS DATA)
const sessionSchema = new mongoose.Schema({
  teacherId: String,
  date: String,
  time: String,
  branch: String,
  type: String,      // Regular / Personal / Group
  duration: Number,  // in minutes
  rate: Number       // ₹ per hour
});


// BRANCH
const branchSchema = new mongoose.Schema({
  branchName: {
    type: String,
    required: true,
    unique: true
  },
  location: {
    type: String,
    required: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});
const payslipSchema = new mongoose.Schema({
  coachId: String,
  coachName: String,
  month: String,
  totalSessions: Number,   // ✅ ADD THIS
  totalHours: Number,
  ratePerHour: Number,
  totalAmount: Number,
  sessions: Array,
  createdAt: { type: Date, default: Date.now }
});


// Prevent duplicate month for same coach
payslipSchema.index({ coachId: 1, month: 1 }, { unique: true });


// ----------------- MODELS -----------------
const Student = mongoose.model("Student", studentSchema);

const Fee = mongoose.model("Fee", feeSchema); // AFTER schema definition

const Attendance = mongoose.model("Attendance", attendanceSchema);
const Teacher = mongoose.model("Teacher", teacherSchema);
const TeacherLog = mongoose.model("TeacherLog", teacherLogSchema);
const Session = mongoose.model("Session", sessionSchema);

const Payslip = mongoose.model("Payslip", payslipSchema);


// ================= ADMIN MIDDLEWARE =================
const isAdmin = async (req, res, next) => {
  try {
    const { userId } = req.body;

    const user = await Teacher.findById(userId);

    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    next(); // allow request to continue

  } catch (err) {
    res.status(500).json({ message: "Authorization failed" });
  }
};


// ----------------- MIDDLEWARE -----------------
app.use(cors());
app.use(express.json()); 
app.use(express.static("public"));

// 👇 ADD THIS HERE
app.get("/", (req, res) => {
  res.send("Server is running 🚀");
});



// ================= ADD TEACHER =================
app.post("/api/teachers",  async (req, res) => {

  try {
    const { name, username, password } = req.body;

    if (!name || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const existing = await Teacher.findOne({ username });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Username already exists"
      });
    }

  await Teacher.create({
  name,
  username,
  password
});


    res.json({
      success: true,
      message: "Coach added successfully"
    });

  } catch (err) {
    console.error("ADD TEACHER ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


// ================= GET ALL TEACHERS =================
app.get("/api/teachers", async (req, res) => {
  try {
    const teachers = await Teacher.find().select("-password");

    res.json(teachers);

  } catch (err) {
    console.error("GET TEACHERS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


// TEACHER LOGIN + SESSION LOG
app.post("/api/teacher/login-session", async (req, res) => {
  try {
    const {
      name,
      username,
      password,
    
      sessionType,
      sessionHours,
      sessionMinutes
    } = req.body;

  // only identity check
const teacher = await Teacher.findOne({ username });

if (!teacher) {
  return res.json({ success: false, message: "Invalid credentials" });
}

const isMatch = await bcrypt.compare(password, teacher.password);

if (!isMatch) {
  return res.json({ success: false, message: "Invalid credentials" });
}





    const now = new Date();

   




 // 1️⃣ Save LOGIN HISTORY
    const log = await TeacherLog.create({
        teacherId: teacher._id.toString(), 
      teacherName: teacher.name,
      loginDate: now.toISOString().split("T")[0],
      loginTime: now.toLocaleTimeString(),
      sessionType,
      sessionHours,
      sessionMinutes
    });

    // 2️⃣ CREATE SESSION (IMPORTANT)
    await Session.create({
      teacherId: teacher._id.toString(),
      date: now.toISOString().split("T")[0],
      time: now.toLocaleTimeString(),
      branch: "",
      type: sessionType,
      duration: (sessionHours || 0) * 60 + (sessionMinutes || 0)
    });


    res.json({
      success: true,
      teacher: {
        id: teacher._id,
        name: teacher.name
      }
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// GET TEACHERS BY BRANCH (FROM LOGS)
app.get("/api/teacher/by-branch/:branch", async (req, res) => {
  const teachers = await TeacherLog
    .find({ branch: new RegExp(`^${req.params.branch}$`, "i") })
    .distinct("teacherName");

  res.json({ success: true, teachers });
});




// SAVE BRANCH FOR CURRENT SESSION
app.post("/api/teacher/select-branch", async (req, res) => {
  try {
    const { teacherName, branch } = req.body;

    // latest teacher log
    const log = await TeacherLog.findOne({ teacherName })
      .sort({ loginDate: -1, loginTime: -1 });

    if (!log) {
      return res.json({ success: false, message: "Log not found" });
    }

    log.branch = branch;
    await log.save();

    //  session update
   await Session.findOneAndUpdate(
  { teacherId: log.teacherId },     
  { branch },
  { sort: { date: -1, time: -1 }, new: true }
);


    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});






//  ADD STUDENT (ADMIN)
app.post("/api/admin/add-student", async (req, res) => {

  try {
    const { name, branch, phone, status } = req.body;

    await Student.create({ name, branch, phone, status });

    res.json({
      success: true,
      message: "Student added successfully"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});



// GET ALL STUDENTS
app.get("/api/students", async (req, res) => {
  try {
    const { branch, status } = req.query;

    let filter = {};
    if (branch) {
      filter.branch = new RegExp(`^${branch}$`, "i");
    }
    if (status) {
      const normalizedStatus = String(status).trim();
      if (normalizedStatus.toLowerCase() === "current") {
        filter.$or = [
          { status: "Current" },
          { status: { $exists: false } },
          { status: null },
          { status: "" }
        ];
      } else {
        filter.status = normalizedStatus;
      }
    }

    const students = await Student.find(filter).sort({ name: 1 });

    res.json({
      success: true,
      students
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});



app.delete("/api/admin/delete-student/:id",  async (req, res) => {

  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// EDIT STUDENT (ADMIN)
app.put("/api/admin/edit-student/:id",  async (req, res) => {

  try {
    const { name, branch, phone, status } = req.body;

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      { name, branch, phone, status },
      { new: true } // returns updated doc
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Student not found" });
    }

    res.json({
      success: true,
      message: "Student updated successfully",
      student: updated
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


// GET STUDENTS BY BRANCH


//  SAVE ATTENDANCE
app.post("/api/attendance/save", async (req, res) => {
  try {
    const { date, records, branch } = req.body;

    await Attendance.deleteMany({ date, branch });

    const data = records.map(r => ({
      studentId: r.studentId,
      name: r.name,
      branch,
      date,
      
      status: r.status
    }));

    await Attendance.insertMany(data);

    res.json({
      success: true,
      message: "Attendance saved successfully"
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

//  GET ATTENDANCE FOR CSV
app.get("/api/attendance/:date/:branch", async (req, res) => {
  try {
    const data = await Attendance.find({
      date: req.params.date,
      branch: new RegExp(`^${req.params.branch}$`, "i")
    });

    res.json({
      success: true,
      data
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});











// Get sessions for a teacher
app.get('/api/sessions', async (req, res) => {
  const teacherId = req.query.teacherId;
  try {
    const sessions = await Session.find({ teacherId });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});







// Update a session
app.put('/api/sessions/:id', async (req, res) => {
  try {
    const updated = await Session.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete a session
app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await Session.findByIdAndDelete(req.params.id);
    res.json({ message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ----------------- ROUTES -----------------
// SAVE FEES
// app.post("/api/fees/save", async (req, res) => {
//   try {
//     const {
//       studentId,
//       branch,
//       feeDate,
//       totalFee,
//       paidAmount,
//       paymentMode
//     } = req.body;

//     if (!studentId) {
//       return res.status(400).json({
//         success: false,
//         message: "Student ID is required"
//       });
//     }

//     // 🔥 Convert properly to Number
//     const total = Number(totalFee) || 0;
//     const paid = Number(paidAmount) || 0;

//     const dueAmount = total - paid;

//     let status = "Unpaid";
//     if (dueAmount <= 0) {
//       status = "Paid";
//     } else if (paid > 0) {
//       status = "Partial";
//     }

//     await Fee.create({
//       studentId,
//       branch,
//       feeDate,
//       totalFee: total,
//       paidAmount: paid,
//       dueAmount,
//       status,
//       paymentMode
//     });

//     res.json({ success: true });

//   } catch (error) {
//     console.error("SAVE FEE ERROR:", error);
//     res.status(500).json({ success: false });
//   }
// });
app.post("/api/fees/save", async (req, res) => {
  try {
    const {
      studentId,
      branch,
      feeDate,
      totalFee,
      paidAmount,
      paymentMode
    } = req.body;

    if (!studentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required"
      });
    }

    const total = Number(totalFee) || 0;
    const paid = Number(paidAmount) || 0;

    // 🔥 1. GET PREVIOUS PAYMENTS
    const previousFees = await Fee.find({ studentId });

    let totalPaidSoFar = 0;

    previousFees.forEach(f => {
      totalPaidSoFar += f.paidAmount;
    });

    // 🔥 2. ADD CURRENT PAYMENT
    const newTotalPaid = totalPaidSoFar + paid;

    // 🔥 3. CALCULATE DUE
    let dueAmount = total - newTotalPaid;

    if (dueAmount < 0) dueAmount = 0;

    // 🔥 4. STATUS
    let status = "Unpaid";

    if (dueAmount === 0) {
      status = "Paid";
    } else if (newTotalPaid > 0) {
      status = "Partial";
    }

    // 🔥 5. SAVE ENTRY
    await Fee.create({
      studentId,
      branch,
      feeDate,
      totalFee: total,
      paidAmount: paid,
      dueAmount,
      status,
      paymentMode
    });

    res.json({ success: true });

  } catch (error) {
    console.error("SAVE FEE ERROR:", error);
    res.status(500).json({ success: false });
  }
});


// GET ALL FEES
app.get("/api/fees", async (req, res) => {
  try {
    const fees = await Fee.find()
      .populate("studentId", "name branch phone")
      .sort({ feeDate: -1 });

    res.json({ success: true, fees });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// FEES REMINDER LIST
app.get("/api/fees/reminders", async (req, res) => {
  try {
    const fees = await Fee.find({
      status: { $ne: "Paid" }
    }).populate("studentId", "name branch phone");

    res.json({ success: true, fees });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



// GET SINGLE FEE
app.get("/api/fees/:id", async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id)
      .populate("studentId", "name branch phone");

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: "Fee not found"
      });
    }

    res.json({
      success: true,
      fee
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


// DELETE FEE
app.delete("/api/fees/:id", async (req, res) => {
  try {
    const deleted = await Fee.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Fee not found"
      });
    }

    res.json({
      success: true,
      message: "Fee deleted successfully"
    });

  } catch (err) {
    console.error("DELETE FEE ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Error deleting fee"
    });
  }
});

// UPDATE FEE
// UPDATE FEE
app.put("/api/fees/:id", async (req, res) => {
  try {
    const {
      studentId,
      branch,
      feeDate,
      totalFee,
      paidAmount,
      paymentMode
    } = req.body;

    // Convert to number
    const total = Number(totalFee) || 0;
    const paid = Number(paidAmount) || 0;
    const dueAmount = total - paid;

    let status = "Unpaid";
    if (dueAmount <= 0) {
      status = "Paid";
    } else if (paid > 0) {
      status = "Partial";
    }

    const updated = await Fee.findByIdAndUpdate(
      req.params.id,
      {
        studentId,
        branch,
        feeDate,
        totalFee: total,
        paidAmount: paid,
        dueAmount,
        status,
        paymentMode
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Fee not found"
      });
    }

    res.json({
      success: true,
      message: "Fee updated successfully"
    });

  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


// GET ALL DUE FEES (For WhatsApp Reminder)
app.get("/api/fees/due", async (req, res) => {
  try {
    const fees = await Fee.find({
      dueAmount: { $gt: 0 }   // only fees where due > 0
    }).populate("studentId"); // get student details

    res.json({
      success: true,
      fees
    });

  } catch (err) {
    console.error("DUE FEES ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


// ================= WHATSAPP SEND =================
app.post("/api/whatsapp/send", async (req, res) => {
  try {
    const { feeId, messageTemplate } = req.body;

    const fee = await Fee.findById(feeId)
      .populate("studentId", "name phone branch");

    if (!fee) {
      return res.status(404).json({
        success: false,
        message: "Fee not found"
      });
    }

    const student = fee.studentId;

    // Replace placeholders
    let message = messageTemplate
      .replace("{name}", student.name)
      .replace("{date}", fee.feeDate);

    console.log("Sending WhatsApp to:", student.phone);
    console.log("Message:", message);

    // 🔴 Here you will later integrate real WhatsApp API
    // For now we just simulate success

    res.json({
      success: true,
      message: "Reminder sent successfully"
    });

  } catch (err) {
    console.error("WHATSAPP ERROR:", err);
    res.status(500).json({
  success: false,
  message: err.message
});
  }
});



// ================= GET PAYROLL =================
app.get("/api/payroll", async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ message: "Month required" });
    }

    const sessions = await Session.find({
      date: { $regex: `^${month}` }
    });

    const coachMap = {};

    for (let session of sessions) {

      if (!coachMap[session.teacherId]) {
        coachMap[session.teacherId] = {
          teacherId: session.teacherId,
          totalSessions: 0,
          totalHours: 0
        };
      }

      coachMap[session.teacherId].totalSessions += 1;
      coachMap[session.teacherId].totalHours += session.duration / 60;
    }

    const result = [];

    for (let coachId in coachMap) {

      const teacher = await Teacher.findById(coachId);

      if (!teacher) continue;

      result.push({
        teacherName: teacher.name,
        teacherId: coachId,
        totalSessions: coachMap[coachId].totalSessions,
        totalHours: coachMap[coachId].totalHours
      });
    }

    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});


app.post("/api/generate-payslip", async (req, res) => {
  try {
    const {
      coachId,
      coachName,
      month,
      totalSessions,
      totalHours,
      ratePerHour,
      totalAmount
    } = req.body;

    if (!coachId || !month) {
      return res.status(400).json({ message: "Missing data" });
    }

    // 🔥 Check duplicate
    const existing = await Payslip.findOne({ coachId, month });

    if (existing) {
      return res.status(400).json({
        message: "Payslip already generated for this month"
      });
    }

  const payslip = await Payslip.create({
  coachId,
  coachName,
  month,
  totalSessions,
  totalHours,
  ratePerHour,
  totalAmount
});


    res.json({
      success: true,
      message: "Payslip saved successfully",
      payslip
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/coach-sessions", async (req, res) => {
  try {
    const { coachId, month } = req.query;

    if (!coachId || !month) {
      return res.status(400).json({ message: "Coach and month required" });
    }

    const sessions = await Session.find({
      teacherId: coachId,
      date: { $regex: `^${month}` }
    });

    res.json(sessions);

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});


app.get("/api/coach-payslips/:coachId", async (req, res) => {
  try {
    const payslips = await Payslip.find({
      coachId: req.params.coachId
    }).sort({ createdAt: -1 });

    res.json(payslips);

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
app.get("/api/download-payslip/:id", async (req, res) => {
  try {
    const payslip = await Payslip.findById(req.params.id);

    if (!payslip) {
      return res.status(404).json({ message: "Payslip not found" });
    }

    res.json(payslip);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


    

// Dashboard data
app.get("/api/dashboard", async (req, res) => {
  try {
    const totalCoaches = await Teacher.countDocuments();

    const [currentStudents, passedStudents] = await Promise.all([
      Student.countDocuments({
        $or: [
          { status: "Current" },
          { status: { $exists: false } },
          { status: null },
          { status: "" }
        ]
      }),
      Student.countDocuments({ status: "Passed" })
    ]);

    const totalStudents = currentStudents + passedStudents;

    // 🔥 GROUP BY STUDENT → TAKE LATEST RECORD
    const feesAgg = await Fee.aggregate([
      {
        $sort: { feeDate: -1 } // latest first
      },
      {
        $group: {
          _id: "$studentId",
          latestDue: { $first: "$dueAmount" },
          totalPaid: { $sum: "$paidAmount" }
        }
      },
      {
        $group: {
          _id: null,
          totalDue: { $sum: "$latestDue" },
          totalPaid: { $sum: "$totalPaid" }
        }
      }
    ]);

    const expensesAgg = await Payslip.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$totalAmount" }
        }
      }
    ]);

    res.json({
      totalCoaches,
      totalStudents,
      currentStudents,
      passedStudents,
      monthlyIncome: feesAgg[0]?.totalPaid || 0,
      unpaidDues: feesAgg[0]?.totalDue || 0,
      monthlyExpenses: expensesAgg[0]?.totalAmount || 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});


// DELETE COACH
app.delete("/api/teachers/:id", async (req, res) => {
  try {
    const deleted = await Teacher.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Coach not found"
      });
    }

    res.json({
      success: true,
      message: "Coach deleted successfully"
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


// UPDATE coach
app.put("/api/teachers/:id", async (req, res) => {
  try {
    const { name, username, password } = req.body;

    const updateData = { name, username };

    if (password && password.trim() !== "") {
      updateData.password = password;
    }

    await Teacher.findByIdAndUpdate(req.params.id, updateData);
    res.json({ message: "Coach Updated Successfully" });

  } catch (error) {
    res.status(500).json({ message: "Error updating coach" });
  }
});

// ================= ATTENDANCE REPORT =================
app.get("/api/reports/attendance", async (req, res) => {
  try {
    const report = await Attendance.aggregate([
      {
        $group: {
          _id: {
            name: "$name",
            branch: "$branch"
          },
          present: {
            $sum: {
              $cond: [{ $eq: ["$status", "Present"] }, 1, 0]
            }
          },
          absent: {
            $sum: {
              $cond: [{ $eq: ["$status", "Absent"] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          student_name: "$_id.name",
          branch: "$_id.branch",
          present: 1,
          absent: 1
        }
      },
      {
        $sort: { student_name: 1 }
      }
    ]);

    res.json(report);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});
// ================= FEES REPORT =================
app.get("/api/reports/fees", async (req, res) => {
  try {

    const fees = await Fee.find()
      .populate("studentId", "name branch");

    const report = fees.map(f => ({
      student_name: f.studentId?.name || "N/A",
      branch: f.branch,
      date: f.feeDate,
      total: f.totalFee,
      paid: f.paidAmount,
      due: f.dueAmount
    }));

    res.json(report);

  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// ================= COACH REPORT =================
app.get("/api/reports/coach", async (req, res) => {
  try {

    const payslips = await Payslip.find();

    const report = payslips.map(p => ({
      coach_name: p.coachName,
      branch: "N/A",
      month: p.month,
      amount: p.totalAmount,
      status: "Generated"
    }));

    res.json(report);

  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

//------------ PAYMENT -----------------//

app.post("/api/save-payment", async (req, res) => {
  try {
    const saved = await Payment.create(req.body);

    res.json({ success: true });
  } catch (err) {
    console.log("ERROR ❌", err);
    res.status(500).json({ error: "Failed to save payment" });
  }
});

// ================= MONTHLY SUMMARY =================
app.get("/api/reports/monthly", async (req, res) => {
  try {

    const total_students = await Student.countDocuments();

    // 🔥 FIXED FEES AGGREGATION
    const feesAgg = await Fee.aggregate([
      {
        $sort: { feeDate: -1 } // latest first
      },
      {
        $group: {
          _id: "$studentId",
          latestDue: { $first: "$dueAmount" },
          totalPaid: { $sum: "$paidAmount" }
        }
      },
      {
        $group: {
          _id: null,
          totalDue: { $sum: "$latestDue" },
          totalPaid: { $sum: "$totalPaid" }
        }
      }
    ]);

    const payslipAgg = await Payslip.aggregate([
      {
        $group: {
          _id: null,
          totalPayments: { $sum: "$totalAmount" }
        }
      }
    ]);

    res.json({
      total_students,
      fees_collected: feesAgg[0]?.totalPaid || 0,
      pending_fees: feesAgg[0]?.totalDue || 0,
      coach_payments: payslipAgg[0]?.totalPayments || 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({});
  }
});

app.delete("/api/payslips/:id", async (req, res) => {

  try {

    await Payslip.findByIdAndDelete(req.params.id);

    res.json({ success: true });

  } catch (error) {

    res.status(500).json({ error: "Delete failed" });

  }

});


// ----------------- START SERVER -----------------
app.listen(5001, () => {
  console.log(" Server running on port 5001");
});
