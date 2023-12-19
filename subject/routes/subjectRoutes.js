const router = require('express').Router()
const admin = require('../middleware/admin')

// Controllers
const { subject, addSubject, filterSubjects } = require('../controller/subjectController')


// Routes
router.get('/cache/:id', subject)
router.get('/filter', filterSubjects)
router.post('/create', admin, addSubject)

module.exports = router