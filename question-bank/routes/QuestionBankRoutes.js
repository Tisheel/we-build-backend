const router = require('express').Router()

const { addQuestion, editQuestion, deleteQuestion, getQuestions, addManyQuestions, getQuestion } = require('../controllers/QuestionBankController')
const professor = require('../middlewares/professor')

router.post('/add', professor, addQuestion)
router.post('/bulk', addManyQuestions)
router.patch('/edit/:id', professor, editQuestion)
router.delete('/remove/:id', professor, deleteQuestion)
router.post('/', getQuestions)
router.get('/:id', getQuestion)

module.exports = router