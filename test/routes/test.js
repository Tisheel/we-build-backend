const router = require('express').Router()

const { createTestMannual, createTestAuto, startTest, testDetail, finishTest } = require('../controller/testController')
const professor = require('../middleware/professor')
const student = require('../middleware/student')

router.post('/create/manual', professor, createTestMannual)
router.post('/create/auto', professor, createTestAuto)
router.get('/start/:testId', student, startTest)
router.post('/finish', finishTest)
router.get('/:testId', testDetail)

module.exports = router