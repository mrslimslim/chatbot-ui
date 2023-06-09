import { FC, useContext, useState } from 'react';
import { useQuery } from 'react-query'
import { UploadOutlined, InboxOutlined } from '@ant-design/icons';
import { Checkbox, Select, Button, Modal, Radio, Input, Upload, InputNumber, message, Form } from 'antd';
import type { UploadProps } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import { Knowledge as KnowledgeSetting } from '@/types/chat';



interface Props {
    label: string;
    onChangeCheckKnowledge: (checked: boolean) => void;
    onChangeKnowledge: (value: KnowledgeSetting) => void;
}

export const Knowledge: FC<Props> = ({
    label,
    onChangeCheckKnowledge,
    onChangeKnowledge
}) => {
    const [checked, setChecked] = useState(false);
    const [showDialog, setShowDialog] = useState(false);
    const onChange = (e: CheckboxChangeEvent) => {
        console.log(`checked = ${e.target.checked}`);
        setChecked(e.target.checked);
        onChangeCheckKnowledge(e.target.checked);
    };
    const handleChange = (value: string, option: any) => {
        onChangeKnowledge({
            namespace: option.namespace,
            chunkSize: option.chunkSize,
            chunkSizeOverlap: option.chunkSizeOverlap,
        });
    };
    const handleAddKnowledge = () => {
        setShowDialog(true);
    };

    const closeDialog = () => {
        setShowDialog(false);
    }

    const fetchData = async () => {
        const response = await fetch('/api/knowledge-list').then(res => res.json())
        return response.data.map((item: { knowledgeName: any; chunkSize: number, chunkSizeOverlap: number, namespace: string }) => ({
            label: item.knowledgeName,
            value: item.knowledgeName,
            chunkSize: item.chunkSize,
            chunkSizeOverlap: item.chunkSizeOverlap,
            namespace: item.namespace
        }))

    }

    const { data: list, isLoading, error } = useQuery('knowledge', fetchData);
    return <div className="flex flex-col">
        <label className="mb-2 text-left xwtext-neutral-700 dark:text-neutral-400">
            {label}
        </label>
        <div className="w-full  border-neutral-200 bg-transparent pr-2 text-neutral-900 dark:border-neutral-600 dark:text-white">
            <Checkbox onChange={onChange}><span className='text-white'>开启知识库</span></Checkbox>
            {
                checked ? <div className='flex items-center mt-2'>
                    <Select
                        className='w-full bg-transparent mr-2'
                        onChange={handleChange}
                        options={list}
                    />
                    <Button onClick={handleAddKnowledge}><span className='text-white'>新增知识库</span></Button>
                </div> : null
            }

        </div>
        <KnowledgeDialog visible={showDialog} onChangeKnowledge={onChangeKnowledge} closeDialog={closeDialog} />
    </div>;
}

interface KnowledgeDialogProps {
    visible: boolean;
    closeDialog: () => void;
    onChangeKnowledge: (value: KnowledgeSetting) => void;
}

const KnowledgeDialog: FC<KnowledgeDialogProps> = ({
    visible,
    closeDialog
}) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const props: UploadProps = {
        name: 'file',
        action: '/api/upload',
        multiple: false,
        // pdf,cvs,txt
        accept: '.pdf,.csv,.txt,.zip',
        onChange(info) {
            console.log(info);
            if (info.file.status !== 'uploading') {
                console.log(info.file, info.fileList);
            }
            if (info.file.status === 'done') {
                console.log('done');
                message.success(`${info.file.name} file uploaded successfully`);
            } else if (info.file.status === 'error') {
                message.error(`${info.file.name} file upload failed.`);
            }
        },
    };



    const onFinish = async (values: any) => {
        setLoading(true);
        const data = {
            ...values,
            file: values.file[0].response
        }
        const response = await fetch('/api/ingest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        // console.log(response);
        const result = await response.json();
        console.log('result', result);
        if (result.code === 200) {
            message.success('知识库生成成功！');
        }
        setLoading(false);
        resetForm();
        closeDialog();

    };

    const onFinishFailed = (errorInfo: any) => {
        console.log('Failed:', errorInfo);
    };

    const resetForm = () => {
        form.resetFields();
    };

    return (
        <Modal
            open={visible}
            onCancel={closeDialog}
            maskClosable={false}
            title="新增知识库"
            footer={[
                <Button loading={loading} key="generate" form="knowledgeForm" htmlType="submit">
                    生成知识库
                </Button>
            ]}
        >
            <div className='p-10'>
                <Form
                    id="knowledgeForm"
                    form={form}
                    onFinish={onFinish}
                    onFinishFailed={onFinishFailed}
                >
                    <Form.Item
                        label="知识名称"
                        name="knowledgeName"
                        rules={[
                            {
                                required: true,
                                message: '请输入知识名称！',
                            },
                        ]}
                    >
                        <Input />
                    </Form.Item>
                  
                    <Form.Item
                        label="上传文件"
                        name="file"
                        valuePropName="fileList"
                        getValueFromEvent={e => (Array.isArray(e) ? e : e && e.fileList)}
                        rules={[
                            {
                                required: true,
                                message: '请上传文件！',
                            },
                        ]}
                    >
                        {/* <Upload {...props}  >
                            <Button icon={<UploadOutlined />}>Click to Upload</Button>
                        </Upload> */}
                        {/* 根据isDirectoryUpload判断是否是文件上传 */}
                        <Upload.Dragger {...props} directory={form.getFieldValue('isDirectoryUpload') === 2}>
                            <p className="ant-upload-drag-icon">
                                <InboxOutlined />
                            </p>
                            <p className="ant-upload-text">点击或者拖拽文件到此区域上传</p>
                            <p className="ant-upload-hint">
                                支持单个文件上传，支持文件类型：pdf,csv,txt
                            </p>
                        </Upload.Dragger>
                    </Form.Item>
                    <Form.Item
                        label="chunkSize"
                        name="chunkSize"
                        initialValue={1000}
                        rules={[
                            {
                                required: true,
                                message: '请输入 chunkSize！',
                            },
                        ]}
                    >
                        <InputNumber />
                    </Form.Item>
                    <Form.Item
                        label="chunkSizeOverlap"
                        name="chunkSizeOverlap"
                        initialValue={0}
                        rules={[
                            {
                                required: true,
                                message: '请输入 chunkSizeOverlap！',
                            },
                        ]}
                    >
                        <InputNumber />
                    </Form.Item>
                </Form>
            </div>
        </Modal>
    );
};