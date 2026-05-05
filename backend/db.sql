CREATE TABLE IF NOT EXISTS doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    login VARCHAR(50) UNIQUE,
    password VARCHAR(255),
    name VARCHAR(100)
);
CREATE TABLE IF NOT EXISTS patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT,
    full_name VARCHAR(100),
    passport VARCHAR(50),
    phone VARCHAR(20),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id)
);